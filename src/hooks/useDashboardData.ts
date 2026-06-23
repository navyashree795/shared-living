import { useState, useEffect, useRef, useMemo } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer } from "expo-audio";
import { db } from "../firebaseConfig";
import { Activity } from "../types";
import { getSyncedDate } from "../utils/timeUtils";
import { getCycleStartDate, enforceDataRetentionPolicy } from "../utils/retentionUtils";
import { checkAndDraftRecurringExpenses } from "../utils/expenseUtils";
import { logActivity } from "../utils/activityUtils";

export interface UseDashboardDataParams {
  userId: string | undefined;
  householdId: string | null;
  householdData: any;
  memberProfiles: Record<string, any>;
  onNewUnreadActivity?: () => void;
}

export function useDashboardData({
  userId,
  householdId,
  householdData,
  memberProfiles,
  onNewUnreadActivity,
}: UseDashboardDataParams) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [, setLoadingActivities] = useState(true);
  const [chores, setChores] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadChores, setHasUnreadChores] = useState(false);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [lastSeenActivityTime, setLastSeenActivityTime] = useState<number | null>(null);
  const [trashCountdown, setTrashCountdown] = useState<string | null>(null);
  const [trashReminderSent, setTrashReminderSent] = useState(false);
  const [householdsList, setHouseholdsList] = useState<{ id: string; name: string }[]>([]);

  const unreadCountRef = useRef(0);
  unreadCountRef.current = unreadActivityCount;

  const lastSeenRef = useRef<number | null>(null);
  lastSeenRef.current = lastSeenActivityTime;

  // Load last seen activity timestamp
  useEffect(() => {
    const loadLastSeen = async () => {
      if (!userId) return;
      try {
        const val = await AsyncStorage.getItem(`lastSeenActivity_${userId}`);
        if (val) {
          setLastSeenActivityTime(Number(val));
        } else {
          setLastSeenActivityTime(0);
        }
      } catch (e) {
        console.warn("Error loading lastSeenActivityTime:", e);
        setLastSeenActivityTime(0);
      }
    };
    loadLastSeen();
  }, [userId]);

  // Data retention policy enforcement
  useEffect(() => {
    if (!householdId || !householdData) return;
    const startDay = householdData.billingCycleStartDay || 1;
    enforceDataRetentionPolicy(householdId, startDay);
  }, [householdId, householdData]);

  // List of households user is part of (for switcher)
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "households"),
      where("members", "array-contains", userId),
    );
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

  // Activities listener
  useEffect(() => {
    if (!householdId) return;
    setLoadingActivities(true);
    const q = query(
      collection(db, "households", householdId, "activities"),
      orderBy("createdAt", "desc"),
      limit(30),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Activity,
        );
        setActivities(fetched);
        setLoadingActivities(false);

        if (userId) {
          const relevantNew = fetched.filter(
            (a) =>
              a.userId !== userId &&
              (!a.targetUid || a.targetUid === userId),
          );

          const currentLastSeen = lastSeenRef.current;
          if (currentLastSeen === null) return;

          let newUnreadCount = 0;
          if (currentLastSeen === 0) {
            const latestTime = relevantNew.length > 0
              ? (relevantNew[0].createdAt?.seconds ? relevantNew[0].createdAt.seconds * 1000 : Date.now())
              : Date.now();
            AsyncStorage.setItem(`lastSeenActivity_${userId}`, String(latestTime)).catch((err) =>
              console.warn("Error initializing lastSeenActivity:", err),
            );
            setLastSeenActivityTime(latestTime);
          } else {
            const unreadItems = relevantNew.filter((a) => {
              const activityTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
              return activityTime > currentLastSeen;
            });
            newUnreadCount = unreadItems.length;

            if (newUnreadCount > unreadCountRef.current) {
              if (onNewUnreadActivity) {
                onNewUnreadActivity();
              }
            }
          }
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

  // Trash timer logic
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!householdId) return;

    const timer = setInterval(async () => {
      const now = getSyncedDate();
      const info = householdData?.info;

      if (!info?.trashArrivalTime) {
        setTrashCountdown(null);
        return;
      }

      const [h, m] = info.trashArrivalTime.split(":").map(Number);
      const arrival = new Date(now);
      arrival.setHours(h, m, 0, 0);

      const diff = arrival.getTime() - now.getTime();
      if (diff > 0 && diff < 3 * 60 * 60 * 1000) {
        const totalMins = Math.floor(diff / 60000);
        setTrashCountdown(`${totalMins}m`);

        if (totalMins === 10 && !trashReminderSent) {
          setTrashReminderSent(true);
          try {
            const player = createAudioPlayer({
              uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
            });
            player.play();

            if (isMounted.current) {
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
        setTrashCountdown(null);
        if (diff < 0 || diff > 15 * 60 * 1000) {
          setTrashReminderSent(false);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [householdId, householdData, trashReminderSent]);

  // Messages unread checks
  useEffect(() => {
    if (!householdId || !userId) return;
    const q = query(
      collection(db, "households", householdId, "messages"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some((doc) => {
        const data = doc.data();
        return (
          data.senderId !== userId &&
          (!data.readBy || !data.readBy.includes(userId))
        );
      });
      setHasUnreadMessages(unread);
    });
    return unsub;
  }, [householdId, userId]);

  // Chores listener
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
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

  // Groceries listener
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
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

  // Expenses listener
  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", householdId, "expenses"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setExpenses(fetched);
    });

    const qRecurring = query(
      collection(db, "households", householdId, "expenses"),
      where("isRecurring", "==", true),
    );
    const unsubRecurring = onSnapshot(qRecurring, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      checkAndDraftRecurringExpenses(householdId, fetched);
    });

    return () => {
      unsub();
      unsubRecurring();
    };
  }, [householdId, householdData]);

  // Unread chores listener
  useEffect(() => {
    if (!householdId || !userId) return;
    const q = query(
      collection(db, "households", householdId, "chores"),
      where("assignedToUid", "==", userId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some((doc) => {
        const data = doc.data();
        return !data.seenBy || !data.seenBy.includes(userId);
      });
      setHasUnreadChores(unread);
    });
    return unsub;
  }, [householdId, userId]);

  // Chore reminder check interval
  useEffect(() => {
    const checkUpcomingChores = async () => {
      if (!householdId || chores.length === 0) return;
      const now = getSyncedDate();
      const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
      for (const chore of chores) {
        if (chore.done || chore.reminderSent) continue;
        if (chore.day && !chore.day.includes(currentDay)) continue;
        try {
          const timeParts = (chore.time || "").split(" ");
          if (timeParts.length < 2) continue;
          const [timePart, period] = timeParts;
          const [hours, minutes] = timePart.split(":").map(Number);
          let h = hours % 12;
          if (period.toUpperCase() === "PM") h += 12;
          const choreTime = new Date();
          choreTime.setHours(h, minutes, 0, 0);
          const diffInMs = choreTime.getTime() - now.getTime();
          const diffInMins = diffInMs / (1000 * 60);
          if (diffInMins > 0 && diffInMins <= 5.1) {
            await updateDoc(doc(db, "households", householdId, "chores", chore.id), {
              reminderSent: true,
            });
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
    const interval = setInterval(checkUpcomingChores, 30000);
    return () => clearInterval(interval);
  }, [chores, householdId]);

  // Dynamic agenda items mapping
  const agendaItems = useMemo(() => {
    const items: any[] = [];
    if (!userId) return items;

    // 1. Chores
    const now = getSyncedDate();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
    const pendingChoresToday = chores.filter((c) => {
      if (c.done || c.assignedToUid !== userId) return false;
      if (c.targetDate) {
        const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
        const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return targetDateOnly <= nowDateOnly;
      }
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

    // 2. Debts
    const peerBalances: Record<string, number> = {};
    const membersList = householdData?.members || [];
    membersList.forEach((m: string) => {
      if (m !== userId) peerBalances[m] = 0;
    });

    expenses.forEach((exp) => {
      if (exp.type === "expense" && exp.amount) {
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          exp.splitAmong.forEach((splitUid: string) => {
            if (splitUid !== exp.paidByUid) {
              if (splitUid === userId)
                peerBalances[exp.paidByUid] =
                  (peerBalances[exp.paidByUid] || 0) + share;
              else if (exp.paidByUid === userId)
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
        if (exp.fromPaidUid === userId)
          peerBalances[exp.toReceivedUid] =
            (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        else if (exp.toReceivedUid === userId)
          peerBalances[exp.fromPaidUid] =
            (peerBalances[exp.fromPaidUid] || 0) + exp.amount;
      }
    });

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

    // 3. Groceries
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
    hasUnreadMessages,
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
