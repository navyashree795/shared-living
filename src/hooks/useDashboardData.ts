/*
 * FILE: src/hooks/useDashboardData.ts
 * PURPOSE: The central data aggregation engine of the application. It establishes real-time Firestore listeners
 *          for chores, groceries, expenses, activities, and messages, executes background checkups (such as
 *          enforcing retention, drafting recurring expenses, checking chore deadlines, trash truck reminders),
 *          and dynamically computes roommate balances and agenda updates.
 * WHERE USED: Invoked by DashboardScreen.tsx to fetch consolidated feeds, states, and counts.
 */

// Import React state, lifecycle, reference cache, and memoization hooks
import { useState, useEffect, useRef, useMemo } from "react";
// Import Firestore collection query, ordering, pagination, filter, timestamp, document, and update utilities
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
// Import AsyncStorage to cache user read progress (such as when they last checked activities)
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import audio player SDK from Expo to play trash reminder sounds
import { createAudioPlayer } from "expo-audio";
// Import global database reference
import { db } from "../firebaseConfig";
// Import typescript definition for Activity logs
import { Activity } from "../types";
// Import timezone/time synchronization helper
import { getSyncedDate } from "../utils/timeUtils";
// Import retention utilities to purge old data based on billing cycle
import { getCycleStartDate, enforceDataRetentionPolicy } from "../utils/retentionUtils";
// Import expense utilities to split costs and draft recurring template templates
import { checkAndDraftRecurringExpenses } from "../utils/expenseUtils";
// Import activity writer helper
import { logActivity } from "../utils/activityUtils";

// Interface defining parameters expected by this hook
export interface UseDashboardDataParams {
  // UID of the logged-in user
  userId: string | undefined;
  // Selected household ID
  householdId: string | null;
  // Metadata details of the selected household
  householdData: any;
  // Profile dictionary for all household members
  memberProfiles: Record<string, any>;
  // Optional trigger callback when a new background activity is logged by other roommates
  onNewUnreadActivity?: () => void;
}

/**
 * Custom hook useDashboardData gathers all real-time feeds and executes background automation loops.
 */
export function useDashboardData({
  userId,
  householdId,
  householdData,
  memberProfiles,
  onNewUnreadActivity,
}: UseDashboardDataParams) {
  // State hook storing the latest 30 activities logged by household members
  const [activities, setActivities] = useState<Activity[]>([]);
  // Loader state indicator (currently unused but preserved)
  const [, setLoadingActivities] = useState(true);
  // State hook storing chores loaded for the current cycle
  const [chores, setChores] = useState<any[]>([]);
  // State hook storing grocery checklist items
  const [groceries, setGroceries] = useState<any[]>([]);
  // State hook storing bill splits and payment settlements
  const [expenses, setExpenses] = useState<any[]>([]);
  // State tracking unread chat message counts
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  // State tracking if the current user has any chores they haven't viewed yet
  const [hasUnreadChores, setHasUnreadChores] = useState(false);
  // State tracking the count of new activities logged since the user last checked the log
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  // State storing the millisecond epoch timestamp of when the user last checked activities
  const [lastSeenActivityTime, setLastSeenActivityTime] = useState<number | null>(null);
  // State storing minutes remaining until trash collection (e.g. "15m")
  const [trashCountdown, setTrashCountdown] = useState<string | null>(null);
  // Lock state to prevent double audio beeps/duplicate logs when countdown ticks
  const [trashReminderSent, setTrashReminderSent] = useState(false);
  // State storing all households the user is associated with (used by switcher modals)
  const [householdsList, setHouseholdsList] = useState<{ id: string; name: string }[]>([]);

  // Ref trackers are used to store unread counts and last seen times,
  // allowing listener snapshot callbacks to read the freshest state values without causing effect triggers
  const unreadCountRef = useRef(0);
  unreadCountRef.current = unreadActivityCount;

  const lastSeenRef = useRef<number | null>(null);
  lastSeenRef.current = lastSeenActivityTime;

  // Effect: Load the user's last seen activity timestamp from persistent AsyncStorage cache
  useEffect(() => {
    const loadLastSeen = async () => {
      if (!userId) return;
      try {
        const val = await AsyncStorage.getItem(`lastSeenActivity_${userId}`);
        if (val) {
          // Parse value as millisecond epoch
          setLastSeenActivityTime(Number(val));
        } else {
          // If no value is cached, default to 0
          setLastSeenActivityTime(0);
        }
      } catch (e) {
        console.warn("Error loading lastSeenActivityTime:", e);
        setLastSeenActivityTime(0);
      }
    };
    loadLastSeen();
  }, [userId]);

  // Effect: Enforces database data retention policy (purging items older than 2 cycles)
  useEffect(() => {
    if (!householdId || !householdData) return;
    // Default to the 1st of the month if no cycle start day is defined
    const startDay = householdData.billingCycleStartDay || 1;
    enforceDataRetentionPolicy(householdId, startDay);
  }, [householdId, householdData]);

  // Effect: Fetch and sync all households the user belongs to (e.g. for switching flats)
  useEffect(() => {
    if (!userId) return;
    // Query households where the members array contains the user's UID
    const q = query(
      collection(db, "households"),
      where("members", "array-contains", userId),
    );
    // Listen to changes in the user's household list
    const unsub = onSnapshot(q, (snap) => {
      setHouseholdsList(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Unnamed Household",
        })),
      );
    });
    return unsub;
  }, [userId]);

  // Effect: Fetch the latest 30 activity logs and compute unread activity badge numbers
  useEffect(() => {
    if (!householdId) return;
    setLoadingActivities(true);
    // Order activities chronologically descending, limiting to the latest 30 logs
    const q = query(
      collection(db, "households", householdId, "activities"),
      orderBy("createdAt", "desc"),
      limit(30),
    );
    // Establish real-time listener
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Activity,
        );
        setActivities(fetched);
        setLoadingActivities(false);

        if (userId) {
          // Filter logs to find events created by other roommates which target this user or the whole home
          const relevantNew = fetched.filter(
            (a) =>
              a.userId !== userId &&
              (!a.targetUid || a.targetUid === userId),
          );

          const currentLastSeen = lastSeenRef.current;
          // Wait until initial AsyncStorage loading finishes
          if (currentLastSeen === null) return;

          let newUnreadCount = 0;
          // If the user has never checked activities before (lastSeen == 0)
          if (currentLastSeen === 0) {
            // Set the checkpoint time to now
            const latestTime = relevantNew.length > 0
              ? (relevantNew[0].createdAt?.seconds ? relevantNew[0].createdAt.seconds * 1000 : Date.now())
              : Date.now();
            AsyncStorage.setItem(`lastSeenActivity_${userId}`, String(latestTime)).catch((err) =>
              console.warn("Error initializing lastSeenActivity:", err),
            );
            setLastSeenActivityTime(latestTime);
          } else {
            // Count how many logs have a creation timestamp greater than the user's last seen time
            const unreadItems = relevantNew.filter((a) => {
              const activityTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
              return activityTime > currentLastSeen;
            });
            newUnreadCount = unreadItems.length;

            // If new unread items are detected and count grew, trigger visual/sound callbacks
            if (newUnreadCount > unreadCountRef.current) {
              if (onNewUnreadActivity) {
                onNewUnreadActivity();
              }
            }
          }
          // Save the calculated unread badge number
          setUnreadActivityCount(newUnreadCount);
        }
      },
      (err) => {
        console.error("Error subscribing to activities:", err);
        setLoadingActivities(false);
      },
    );
    return unsub;
  }, [householdId, userId, onNewUnreadActivity]);

  // Ref flag tracking if the hook is active, avoiding execution of updates if user leaves the screen
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Effect: Handles trash countdown timer and warning notification checks (updates every second)
  useEffect(() => {
    if (!householdId) return;

    const timer = setInterval(async () => {
      const now = getSyncedDate();
      const info = householdData?.info;

      // Skip timer if no trash arrival schedule time is configured
      if (!info?.trashArrivalTime) {
        setTrashCountdown(null);
        return;
      }

      // Parse schedule hour/minute integers from format "HH:mm"
      const [h, m] = info.trashArrivalTime.split(":").map(Number);
      const arrival = new Date(now);
      arrival.setHours(h, m, 0, 0);

      // Compute millisecond duration differences between current clock and collection time
      const diff = arrival.getTime() - now.getTime();
      
      // If the truck arrives within 3 hours, show a minutes countdown
      if (diff > 0 && diff < 3 * 60 * 60 * 1000) {
        const totalMins = Math.floor(diff / 60000);
        setTrashCountdown(`${totalMins}m`);

        // If exactly 10 minutes remain, trigger audio alerts and log a household event
        if (totalMins === 10 && !trashReminderSent) {
          setTrashReminderSent(true);
          try {
            // Load and play a warning audio clip
            const player = createAudioPlayer({
              uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
            });
            player.play();

            if (isMounted.current) {
              // Post a message in the activity log on behalf of "Trash Bot"
              await logActivity(
                householdId,
                "chore_reminder",
                `Trash Truck in 10m!`,
                "Trash Bot",
              );
            }
          } catch (e) {
            console.error("Error in trash reminder:", e);
          }
        }
      } else {
        // Clear countdown display if time is outside the 3-hour window
        setTrashCountdown(null);
        // Reset reminder lock key if target passes or is far away
        if (diff < 0 || diff > 15 * 60 * 1000) {
          setTrashReminderSent(false);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [householdId, householdData, trashReminderSent]);

  // Effect: Count unread messages inside the household chatroom
  useEffect(() => {
    if (!householdId || !userId) return;
    // Pull the latest 20 message snapshots sorted chronologically descending
    const q = query(
      collection(db, "households", householdId, "messages"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    // Listen for changes
    const unsub = onSnapshot(q, (snap) => {
      // Filter out messages written by the active user, or messages where active user UID is in read list
      const count = snap.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.senderId !== userId &&
          (!data.readBy || !data.readBy.includes(userId))
        );
      }).length;
      setUnreadMessagesCount(count);
    });
    return unsub;
  }, [householdId, userId]);

  // Effect: Synchronize chores list for the current and prior cycle
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    // Fetch chores dating back up to 2 months prior to current cycle to show recent history
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", householdId, "chores"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setChores(fetched);
    });
    return unsub;
  }, [householdId, householdData]);

  // Effect: Synchronize groceries list for the current and prior cycle
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    // Fetch groceries dating back 2 cycles
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", householdId, "groceries"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setGroceries(fetched);
    });
    return unsub;
  }, [householdId, householdData]);

  // Effect: Synchronize expenses list and handle auto-generation of recurring templates
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    // Fetch expenses dating back 2 cycles
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    // Query 1: Regular and historical expenses
    const q = query(
      collection(db, "households", householdId, "expenses"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setExpenses(fetched);
    });

    // Query 2: Recurring bills configuration templates
    const qRecurring = query(
      collection(db, "households", householdId, "expenses"),
      where("isRecurring", "==", true),
    );
    const unsubRecurring = onSnapshot(qRecurring, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      // Call background utility helper to check and draft invoices for the current billing cycle month
      checkAndDraftRecurringExpenses(householdId, fetched);
    });

    // Tear down both listeners on unmount
    return () => {
      unsub();
      unsubRecurring();
    };
  }, [householdId, householdData]);

  // Effect: Listen for chores assigned to the active user that they have not marked as seen
  useEffect(() => {
    if (!householdId || !userId) return;
    const q = query(
      collection(db, "households", householdId, "chores"),
      where("assignedToUid", "==", userId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some((doc) => {
        const data = doc.data();
        // Returns true if seenBy list doesn't contain the user's UID
        return !data.seenBy || !data.seenBy.includes(userId);
      });
      setHasUnreadChores(unread);
    });
    return unsub;
  }, [householdId, userId]);

  // Effect: Background chore due reminder engine (checks status flags every 30 seconds)
  useEffect(() => {
    const checkUpcomingChores = async () => {
      if (!householdId || chores.length === 0) return;
      const now = getSyncedDate();
      const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
      
      // Iterate through current chores
      for (const chore of chores) {
        // Skip completed chores or those which already fired notifications
        if (chore.done || chore.reminderSent) continue;
        // Skip if chore is not scheduled for today
        if (chore.day && !chore.day.includes(currentDay)) continue;
        
        try {
          // Parse time parameter string (e.g. "06:30 PM")
          const timeParts = (chore.time || "").split(" ");
          if (timeParts.length < 2) continue;
          const [timePart, period] = timeParts;
          const [hours, minutes] = timePart.split(":").map(Number);
          
          let h = hours % 12;
          if (period.toUpperCase() === "PM") h += 12;
          
          const choreTime = new Date();
          choreTime.setHours(h, minutes, 0, 0);
          
          // Calculate duration remaining in minutes
          const diffInMs = choreTime.getTime() - now.getTime();
          const diffInMins = diffInMs / (1000 * 60);
          
          // If chore is due within the next 5 minutes
          if (diffInMins > 0 && diffInMins <= 5.1) {
            // Update reminderSent flat to true in Firestore to prevent duplicate prompts
            await updateDoc(doc(db, "households", householdId, "chores", chore.id), {
              reminderSent: true,
            });
            // Post a warning in activities log
            await logActivity(
              householdId,
              "chore_reminder",
              `${chore.title} in 5m`,
              "Assistant",
              0,
              chore.assignedToUid,
            );
          }
        } catch (e) {
          console.error("Error in Dashboard hook reminder engine:", e);
        }
      }
    };
    
    // Set up check intervals
    const interval = setInterval(checkUpcomingChores, 30000);
    return () => clearInterval(interval);
  }, [chores, householdId]);

  // Memoized Calculation: Translates raw collections into actionable cards for the dashboard Agenda Feed
  const agendaItems = useMemo(() => {
    const items: any[] = [];
    if (!userId) return items;

    // 1. COMPUTE DUE CHORES FEED CARD
    const now = getSyncedDate();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
    const pendingChoresToday = chores.filter((c) => {
      // Find chores assigned to the user that are incomplete (done == false)
      if (c.done || c.assignedToUid !== userId) return false;
      if (c.targetDate) {
        const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
        const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Show if target date is today or has passed (overdue)
        return targetDateOnly <= nowDateOnly;
      }
      // Show if weekly day targets matches today's weekday
      return c.day?.includes(currentDay);
    });
    if (pendingChoresToday.length > 0) {
      items.push({
        id: "agenda-chores",
        type: "chore",
        title: `Good Morning! You have ${pendingChoresToday.length} chore${pendingChoresToday.length > 1 ? "s" : ""} today.`,
        subtitle: pendingChoresToday
          .map((c) => `${c.title} at ${c.time}`)
          .join(", "),
        icon: "cleaning-services",
        color: "#D97706",
        navTarget: "Chores",
      });
    }

    // 2. COMPUTE PEER BALANCES & DEBTS FEED CARD
    const peerBalances: Record<string, number> = {};
    const membersList = householdData?.members || [];
    // Initialize ledger accounts for all flatmates to 0
    membersList.forEach((m: string) => {
      if (m !== userId) peerBalances[m] = 0;
    });

    // Scan all transactions inside this cycle
    expenses.forEach((exp) => {
      if (exp.type === "expense" && exp.amount) {
        // Shared bills splitting logic:
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          exp.splitAmong.forEach((splitUid: string) => {
            // Payer is owed share amounts by other split members
            if (splitUid !== exp.paidByUid) {
              if (splitUid === userId)
                // If I am a split member, my debt to the payer increases by my share
                peerBalances[exp.paidByUid] =
                  (peerBalances[exp.paidByUid] || 0) + share;
              else if (exp.paidByUid === userId)
                // If I paid, the other split member's debt to me increases (meaning negative balance for them)
                peerBalances[splitUid] = (peerBalances[splitUid] || 0) - share;
            }
          });
        }
      } else if (
        exp.type === "payment" &&
        exp.amount &&
        exp.fromPaidUid &&
        exp.toReceivedUid
      ) {
        // Direct settlements logic:
        if (exp.fromPaidUid === userId)
          // If I transferred money to flatmate, my debt to them decreases by the payment amount
          peerBalances[exp.toReceivedUid] =
            (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        else if (exp.toReceivedUid === userId)
          // If flatmate settled with me, their debt to me decreases
          peerBalances[exp.fromPaidUid] =
            (peerBalances[exp.fromPaidUid] || 0) + exp.amount;
      }
    });

    // Loop through roommate ledger values. If balance is positive, user owes money.
    Object.entries(peerBalances).forEach(([uid, amount]) => {
      if (amount > 0.01) {
        const profile = memberProfiles[uid];
        const name = profile?.username ? profile.username : "Member";
        items.push({
          id: `agenda-debt-${uid}`,
          type: "debt",
          title: `You currently owe ${name} ₹${Math.ceil(amount)}.`,
          subtitle: "Tap to settle up in Expenses.",
          icon: "account-balance-wallet",
          color: "#EF4444",
          navTarget: "Expenses",
        });
      }
    });

    // 3. COMPUTE OUT OF STOCK GROCERIES CARD
    const pendingGroceries = groceries.filter((g) => !g.done);
    if (pendingGroceries.length > 0) {
      items.push({
        id: "agenda-groceries",
        type: "grocery",
        title:
          `We are out of ${pendingGroceries[0]?.name}` +
          (pendingGroceries.length > 1
            ? ` and ${pendingGroceries.length - 1} other item${pendingGroceries.length > 2 ? "s" : ""}`
            : "") +
          ".",
        subtitle: `${pendingGroceries.length} pending item${pendingGroceries.length > 1 ? "s" : ""} in groceries.`,
        icon: "shopping-cart",
        color: "#059669",
        navTarget: "Grocery",
      });
    }

    return items;
  }, [
    chores,
    expenses,
    groceries,
    userId,
    householdData?.members,
    memberProfiles,
  ]);

  return {
    activities,
    chores,
    groceries,
    expenses,
    unreadMessagesCount,
    hasUnreadChores,
    unreadActivityCount,
    lastSeenActivityTime,
    trashCountdown,
    agendaItems,
    householdsList,
    setLastSeenActivityTime,
    setUnreadActivityCount,
  };
}
