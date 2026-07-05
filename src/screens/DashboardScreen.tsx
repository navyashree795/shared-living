/*
 * FILE: src/screens/DashboardScreen.tsx
 * PURPOSE: Root hub of the application. It dynamically switches layout widgets based on household type 
 *          (Standard Roommates vs. Travel Trips), coordinates foreground GPS geofencing status updates,
 *          handles unread chime animations, manages announcements boards, and triggers quick forms modals.
 * WHERE USED: Mounted as a tab screen option inside MainTabs (App.tsx).
 */

// Import React hooks for states, inputs focus, memoizations, and callbacks caching
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
// Import layout components, touch listeners, scrolls, clipboard copies, web linkings, and indicators
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
  Linking,
  Alert,
  TextInput,
} from "react-native";
// Import Expo audio library to play custom notification alerts
import { createAudioPlayer } from "expo-audio";
// Import notch layout safe constraints
import { SafeAreaView } from "react-native-safe-area-context";
// Import icon libraries
import { MaterialIcons } from "@expo/vector-icons";
// Import styling gradients
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
// Import AsyncStorage to cache contexts details for foreground location helpers
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import Firestore commands to subscribe to collections, commit writes, query dates, and manage subdocuments
import {
  doc,
  updateDoc,
  arrayRemove,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
// Import helper utilities
import { scheduleChoreReminder, cancelChoreReminder, syncItineraryReminders } from "../utils/notificationUtils";
import { logActivity } from "../utils/activityUtils";
import { db, auth } from "../firebaseConfig";
import { useUser } from "../context/UserContext";
import { useHousehold } from "../context/HouseholdContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
// Import components
import { Avatar } from "../components/Avatar";
import { getSyncedDate } from "../utils/timeUtils";
import { useDashboardData } from "../hooks/useDashboardData";
import { HeroGreeting } from "../components/dashboard/HeroGreeting";
import { InfoCardsDeck } from "../components/dashboard/InfoCardsDeck";
import { QuickActions } from "../components/dashboard/QuickActions";
import SlideModal from "../components/SlideModal";
// Import specialized overlay modals
import { MembersModal } from "../components/modals/MembersModal";
import { NotificationsModal } from "../components/modals/NotificationsModal";
import { InfoEditModal } from "../components/modals/InfoEditModal";
import { HouseholdSwitcherModal } from "../components/modals/HouseholdSwitcherModal";
import { TripDetailsEditModal } from "../components/modals/TripDetailsEditModal";
import { ItineraryEditModal } from "../components/modals/ItineraryEditModal";
import { PackingEditModal } from "../components/modals/PackingEditModal";
import { TravelWrapModal } from "../components/modals/TravelWrapModal";
import { ItineraryItem, PackingItem } from "../types";
import { QuickBuyModal } from "../components/modals/QuickBuyModal";
import { QuickSettleModal } from "../components/modals/QuickSettleModal";
import { QuickExpenseModal } from "../components/modals/QuickExpenseModal";
import { QuickChoreModal } from "../components/modals/QuickChoreModal";
// Import Location libraries for geofencing home range presence status
import * as Location from "expo-location";
import { isInsideHomeRadius } from "../utils/locationUtils";

type Props = { navigation: any; route?: any };

/**
 * DashboardScreen displays greetings decks, summary metrics, sticky boards, and trip checklists.
 */
export default function DashboardScreen({ navigation }: Props) {
  // Grab household details from context
  const { householdId, setHouseholdId } = useHousehold();
  const hid = householdId ?? "";
  
  // Grab active theme mode
  const { isDark } = useTheme();
  
  // Grab toast contexts
  const { showToast } = useToast();
  // Grab user accounts and profile info
  const { user, profile: userData } = useUser();
  const { householdData, memberProfiles, getMemberName, members } = useHousehold();

  // Modals visibility toggles states
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
  const [isHouseholdSwitcherVisible, setIsHouseholdSwitcherVisible] = useState(false);
  const [isTripDetailsModalVisible, setIsTripDetailsModalVisible] = useState(false);
  const [isItineraryModalVisible, setIsItineraryModalVisible] = useState(false);
  const [isPackingModalVisible, setIsPackingModalVisible] = useState(false);
  const [isTravelWrapModalVisible, setIsTravelWrapModalVisible] = useState(false);

  // Quick triggers modals visibility states
  const [isQuickBuyVisible, setIsQuickBuyVisible] = useState(false);
  const [isQuickSettleVisible, setIsQuickSettleVisible] = useState(false);
  const [isQuickExpenseVisible, setIsQuickExpenseVisible] = useState(false);
  const [isQuickChoreVisible, setIsQuickChoreVisible] = useState(false);

  // Shared sticky note announcement state
  const [stickyNote, setStickyNote] = useState<{ text: string; updatedBy: string; updatedAt: any; expiresAt?: any; expiryType?: string } | null>(null);
  const [isStickyModalVisible, setIsStickyModalVisible] = useState(false);
  const [stickyText, setStickyText] = useState("");
  const [stickyExpiry, setStickyExpiry] = useState<"never" | "12h" | "24h" | "3d">("never");

  // Edit states variables
  const infoModalTab = "all";
  const [isEditMode, setIsEditMode] = useState(false);
  // Track array list of info field ids that are clicked to visible format
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  // Toggle visible status of wifi details and other encrypted strings
  const toggleFieldVisibility = useCallback((id: string) => {
    setRevealedFields((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  // Set animation value to ring the bell icon
  const bellAnim = useRef(new Animated.Value(1)).current;

  // Callback playing notification audio file and running bell scaling animation sequence
  const handleNewUnreadActivity = useCallback(() => {
    try {
      // Play a short chime tone
      const beep = createAudioPlayer({
        uri: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
      });
      beep.play();
    } catch (e) {
      console.warn("Could not play notification beep", e);
    }

    // Run bell spring scaling sequence
    Animated.sequence([
      Animated.timing(bellAnim, {
        toValue: 1.4,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(bellAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bellAnim]);

  // Aggregate Firestore collections data-listeners hook
  const {
    activities,
    chores,
    groceries,
    expenses,
    agendaItems,
    householdsList,
    unreadActivityCount,
    unreadMessagesCount,
    setLastSeenActivityTime,
    setUnreadActivityCount,
  } = useDashboardData({
    userId: user?.uid,
    householdId,
    householdData,
    memberProfiles,
    onNewUnreadActivity: handleNewUnreadActivity,
  });

  // Memo: Computes total number of chores assigned to current user that are due today
  const { userChoresDoneToday, userChoresTotalToday } = useMemo(() => {
    if (!user?.uid || chores.length === 0) return { userChoresDoneToday: 0, userChoresTotalToday: 0 };
    const now = getSyncedDate();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });

    const myTodayChores = chores.filter((c) => {
      if (c.assignedToUid !== user.uid) return false;
      if (c.targetDate) {
        // Compare target date timestamp bounds
        const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
        const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return targetDateOnly <= nowDateOnly;
      }
      return c.day?.includes(currentDay);
    });

    const doneCount = myTodayChores.filter(c => c.done).length;
    return {
      userChoresDoneToday: doneCount,
      userChoresTotalToday: myTodayChores.length
    };
  }, [chores, user?.uid]);

  // Memo: Counts active unchecked grocery items
  const pendingGroceriesCount = useMemo(() => {
    return groceries.filter((g) => !g.done).length;
  }, [groceries]);

  // Memo: Checks if sticky note exists and has not reached its expiration timestamp
  const isStickyActive = useMemo(() => {
    if (!stickyNote?.text) return false;
    if (!stickyNote.expiresAt) return true;
    try {
      const expTime = typeof stickyNote.expiresAt.toDate === "function"
        ? stickyNote.expiresAt.toDate().getTime()
        : new Date(stickyNote.expiresAt).getTime();
      return expTime > Date.now();
    } catch {
      return true;
    }
  }, [stickyNote]);

  // Memo: Calculate Net Balancing Standing (positive = user is owed, negative = user owes roommate)
  const netBalance = useMemo(() => {
    if (!user?.uid || !members || members.length === 0) return 0;
    const peerBalances: Record<string, number> = {};
    members.forEach((uid) => {
      if (uid !== user.uid) peerBalances[uid] = 0;
    });

    expenses.forEach((exp) => {
      if (exp.type === "expense" && exp.amount) {
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          exp.splitAmong.forEach((splitUid: string) => {
            if (splitUid !== exp.paidByUid) {
              if (splitUid === user.uid)
                peerBalances[exp.paidByUid] = (peerBalances[exp.paidByUid] || 0) + share;
              else if (exp.paidByUid === user.uid)
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
        if (exp.fromPaidUid === user.uid)
          peerBalances[exp.toReceivedUid] = (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        else if (exp.toReceivedUid === user.uid)
          peerBalances[exp.fromPaidUid] = (peerBalances[exp.fromPaidUid] || 0) + exp.amount;
      }
    });

    const sum = Object.values(peerBalances).reduce((acc, val) => acc + val, 0);
    // Inverse sign to align with visual indicator direction (negative total means user owes peers overall)
    return -sum;
  }, [expenses, members, user?.uid]);

  // Memo: Filters and sorts active chores to determine what task is next due today
  const nextChore = useMemo(() => {
    if (chores.length === 0) return null;
    const now = getSyncedDate();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });

    const todayChores = chores.filter((c) => {
      if (c.done) return false;
      if (c.targetDate) {
        const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
        const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return targetDateOnly <= nowDateOnly;
      }
      return c.day?.includes(currentDay);
    });

    // Helper parsing "HH:MM AM/PM" to numeric minutes for sorting
    const parseTime = (timeStr: string) => {
      try {
        const timeMatch = timeStr.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === "PM" && hours < 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        }
      } catch (e) {
        console.warn("Parse time failed:", e);
      }
      return 24 * 60;
    };

    todayChores.sort((a, b) => parseTime(a.time) - parseTime(b.time));

    const myChore = todayChores.find((c) => c.assignedToUid === user?.uid);
    const roommateChore = todayChores.find((c) => c.assignedToUid !== user?.uid);
    // Prioritize user's chore, fall back to roommate's chore
    return myChore || roommateChore || null;
  }, [chores, user?.uid]);

  // Action: Callback to mark a chore complete from the dashboard Greeting Card
  const handleQuickChoreDone = useCallback(async (chore: any) => {
    if (!householdId) return;
    try {
      if (chore.notificationId) {
        await cancelChoreReminder(chore.notificationId);
      }
      await updateDoc(doc(db, "households", householdId, "chores", chore.id), {
        done: true,
        notificationId: null,
      });
      showToast("Chore completed! 🎉", "success");
      logActivity(householdId, "chore_done", chore.title);

      // Rotation logic shifts assignment
      if (chore.rotationEnabled && chore.rotationOrder && chore.rotationOrder.length > 0) {
        const nextIndex = ((chore.currentRotationIndex || 0) + 1) % chore.rotationOrder.length;
        const nextAssignee = chore.rotationOrder[nextIndex];
        
        const baseDate = chore.targetDate ? (typeof chore.targetDate.toDate === "function" ? chore.targetDate.toDate() : new Date(chore.targetDate)) : getSyncedDate();
        const nextTargetDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextNotifId = await scheduleChoreReminder(chore.title, nextTargetDate);

        await addDoc(collection(db, "households", householdId, "chores"), {
          title: chore.title,
          assignedToUid: nextAssignee,
          time: chore.time,
          day: chore.day,
          done: false,
          rotationEnabled: true,
          rotationOrder: chore.rotationOrder,
          currentRotationIndex: nextIndex,
          createdByUid: chore.createdByUid || user?.uid || "",
          createdAt: serverTimestamp(),
          seenBy: [nextAssignee],
          targetDate: Timestamp.fromDate(nextTargetDate),
          notificationId: nextNotifId || null,
        });

        showToast(`Rotated to ${getMemberName(nextAssignee)}`, "info");
        logActivity(householdId, "chore_rotate", chore.title, undefined, 0, nextAssignee);
      }
    } catch (error) {
      console.error("Quick Chore Done Error:", error);
      showToast("Could not complete chore", "error");
    }
  }, [householdId, showToast, getMemberName, user?.uid]);

  // Action: Nudge roommate directly from dashboard Greeting Card
  const handleQuickNudge = useCallback(async (chore: any) => {
    if (!householdId) return;
    try {
      await logActivity(householdId, "chore_reminder", chore.title, undefined, 0, chore.assignedToUid);
      showToast("Nudge sent!", "success");
    } catch (error) {
      console.error("Quick Nudge Error:", error);
    }
  }, [householdId, showToast]);

  const isOwner = householdData?.createdBy === user?.uid;
  const isTravel = householdData?.type === "travel";

  // States caching lists for Travel trip modes
  const [packingList, setPackingList] = useState<PackingItem[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);

  // Effect: Syncs packing checklist items in Travel mode
  useEffect(() => {
    if (!hid || !isTravel) return;
    const q = query(collection(db, "households", hid, "packing_list"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPackingList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingItem)));
    });
    return unsub;
  }, [hid, isTravel]);

  // Effect: Syncs collaborative itinerary timeline items in Travel mode
  useEffect(() => {
    if (!hid || !isTravel) return;
    const q = collection(db, "households", hid, "itinerary");
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItineraryItem));
      // Sort timeline in-memory to prevent needing to build index paths in Firebase
      items.sort((a, b) => {
        const dateComp = (a.date || "").localeCompare(b.date || "");
        if (dateComp !== 0) return dateComp;
        return (a.time || "").localeCompare(b.time || "");
      });
      setItinerary(items);
      syncItineraryReminders(items);
    }, (err) => {
      console.error("Itinerary subscription failed:", err);
    });
    return unsub;
  }, [hid, isTravel]);

  // Action: Saves edited trip parameters and recalibrates expiration dates matching retention rules
  const handleSaveTripDetails = useCallback(async (updates: any) => {
    if (!hid) return;
    try {
      const fieldsToUpdate: any = { tripDetails: updates };
      
      // Calculate dynamic expiration date based on the trip's end date and retention policy
      try {
        if (householdData?.type === 'travel' && householdData?.retentionPolicy && updates.endDate) {
          const dateMatch = updates.endDate.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const day = parseInt(dateMatch[3], 10);
            const parsedDate = new Date(year, month, day, 23, 59, 59, 999);
            
            if (!isNaN(parsedDate.getTime())) {
              const daysToAdd = householdData.retentionPolicy === '15_days_trip_end' ? 15 : 7;
              const expirationDate = new Date(parsedDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
              fieldsToUpdate.expiresAt = expirationDate.toISOString();
            }
          }
        }
      } catch (e) {
        console.warn("Parse time failed:", e);
      }

      await updateDoc(doc(db, "households", hid), fieldsToUpdate);
      showToast("Trip details updated!", "success");
    } catch (e) {
      console.error(e);
      showToast("Could not update trip details", "error");
    }
  }, [hid, householdData, showToast]);

  // Action: Adds a packing item to subcollection in Travel mode
  const handleAddItemPacking = useCallback(async (name: string) => {
    if (!hid) return;
    try {
      await addDoc(collection(db, "households", hid, "packing_list"), {
        name,
        done: false,
        createdAt: serverTimestamp(),
      });
      showToast("Item added!", "success");
    } catch (e) {
      console.error(e);
    }
  }, [hid, showToast]);

  // Action: Toggles checkbox status on a packing item
  const handleToggleItemPacking = useCallback(async (id: string, done: boolean) => {
    if (!hid) return;
    try {
      await updateDoc(doc(db, "households", hid, "packing_list", id), { done });
    } catch (e) {
      console.error(e);
    }
  }, [hid]);

  // Action: Deletes packing item from subcollection
  const handleDeleteItemPacking = useCallback(async (id: string) => {
    if (!hid) return;
    try {
      await deleteDoc(doc(db, "households", hid, "packing_list", id));
      showToast("Item deleted", "info");
    } catch (e) {
      console.error(e);
    }
  }, [hid, showToast]);

  // Action: Adds an event item to itinerary timeline
  const handleAddItineraryItem = useCallback(async (item: any) => {
    if (!hid) return;
    try {
      await addDoc(collection(db, "households", hid, "itinerary"), {
        ...item,
        proposedBy: user?.uid || "",
        createdAt: serverTimestamp(),
      });
      showToast(item.approved ? "Activity added!" : "Activity proposed!", "success");
    } catch (e) {
      console.error(e);
    }
  }, [hid, user?.uid, showToast]);

  // Action: Approves a proposed itinerary event (only accessible by trip creator)
  const handleApproveItineraryItem = useCallback(async (id: string) => {
    if (!hid) return;
    try {
      await updateDoc(doc(db, "households", hid, "itinerary", id), { approved: true });
      showToast("Activity approved!", "success");
    } catch (e) {
      console.error(e);
    }
  }, [hid, showToast]);

  // Action: Deletes event item from itinerary timeline
  const handleDeleteItineraryItem = useCallback(async (id: string) => {
    if (!hid) return;
    try {
      await deleteDoc(doc(db, "households", hid, "itinerary", id));
      showToast("Activity removed", "info");
    } catch (e) {
      console.error(e);
    }
  }, [hid, showToast]);

  // Action: Removes member from the household
  const handleRemoveMember = useCallback(async (memberUid: string) => {
    const profile = memberProfiles[memberUid];
    const name = profile?.username ? `${profile.username}` : profile?.email || "this member";
    
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${name} from the household?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "households", hid), {
                members: arrayRemove(memberUid),
              });
              showToast("Member removed", "success");
            } catch (e: any) {
              console.error("Error removing member:", e);
              showToast("Could not remove member", "error");
            }
          },
        },
      ]
    );
  }, [hid, memberProfiles, showToast]);

  // Action: Updates name/info fields on the household document
  const handleUpdateInfo = useCallback(async (updates: any) => {
    if (!householdId) return;
    if (!isOwner) {
      showToast("Only the household owner can edit info", "error");
      return;
    }
    try {
      const { name, info } = updates;
      await updateDoc(doc(db, "households", hid), { name, info });
      setIsInfoModalVisible(false);
      setIsEditMode(false);
      showToast("Info updated", "success");
    } catch (e: any) {
      console.error("Error updating info:", e);
      showToast("Could not update", "error");
    }
  }, [householdId, hid, isOwner, showToast]);

  // Action: Permanently deletes the household document and removes association for all members
  const handleDeleteHousehold = useCallback(async () => {
    if (!householdId) return;
    if (!isOwner) {
      showToast("Only the household owner can delete the household", "error");
      return;
    }

    Alert.alert(
      "Delete Household",
      "Are you absolutely sure you want to permanently delete this household? All members will be removed, and all data (expenses, chores, groceries, messages) will be lost forever. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            try {
              const memberUids = householdData?.members || [];
              const batch = writeBatch(db);
              
              // 1. Clear householdId reference for all members
              memberUids.forEach((uid: string) => {
                batch.update(doc(db, "users", uid), {
                  householdId: null
                });
              });
              
              // 2. Delete the household document
              batch.delete(doc(db, "households", householdId));
              
              await batch.commit();

              setIsInfoModalVisible(false);
              setIsEditMode(false);
              
              // 3. Reset local selection state
              setHouseholdId(null);
              showToast("Household permanently deleted", "success");
            } catch (e: any) {
              console.error("Error deleting household:", e);
              showToast("Could not delete household", "error");
            }
          }
        }
      ]
    );
  }, [householdId, householdData, isOwner, setHouseholdId, showToast]);

  // Effect: Syncs sticky notice board announcements from Firestore
  useEffect(() => {
    if (!hid) return;
    const docRef = doc(db, "households", hid, "announcements", "sticky");
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setStickyNote(snap.data() as any);
        } else {
          setStickyNote(null);
        }
      },
      (err) => {
        console.warn("Error listening to sticky note:", err);
      }
    );
    return unsub;
  }, [hid]);

  // Helper formatting sticky update timestamp
  const formatStickyTime = useCallback((timestamp: any) => {
    if (!timestamp) return "";
    try {
      const d = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, []);

  // Action: Updates sticky notice board contents and sets auto-expiry times
  const handleSaveStickyNote = useCallback(async () => {
    if (!hid) return;
    try {
      let expiresAt: Timestamp | null = null;
      const textVal = stickyText.trim();
      
      // Calculate expiry date if a limit is chosen
      if (textVal && stickyExpiry !== "never") {
        const msToAdd = 
          stickyExpiry === "12h" ? 12 * 60 * 60 * 1000 :
          stickyExpiry === "24h" ? 24 * 60 * 60 * 1000 :
          3 * 24 * 60 * 60 * 1000;
        
        expiresAt = Timestamp.fromDate(new Date(Date.now() + msToAdd));
      }

      const docRef = doc(db, "households", hid, "announcements", "sticky");
      await setDoc(docRef, {
        text: textVal,
        expiryType: stickyExpiry,
        expiresAt,
        updatedBy: userData?.username || "Roommate",
        updatedAt: serverTimestamp(),
      });
      setIsStickyModalVisible(false);
      showToast("Sticky note updated", "success");
    } catch (e) {
      console.error("Error saving sticky note:", e);
      showToast("Could not update note", "error");
    }
  }, [hid, stickyText, stickyExpiry, userData?.username, showToast]);

  // Effect: Persist user context reference details into AsyncStorage for background tasks to read
  useEffect(() => {
    if (user?.uid) {
      AsyncStorage.setItem("user_uid", user.uid).catch(err => console.warn("AsyncStorage save user_uid failed:", err));
    }
  }, [user?.uid]);

  // Effect: Cache home location coords into AsyncStorage
  useEffect(() => {
    if (householdData?.info?.homeLocation) {
      AsyncStorage.setItem("home_location", JSON.stringify(householdData.info.homeLocation)).catch(err => console.warn("AsyncStorage save home_location failed:", err));
    }
  }, [householdData?.info?.homeLocation]);

  // Effect: Setup Foreground Location Tracking loop to geofence status checks
  useEffect(() => {
    if (!user?.uid || !householdId || !householdData || householdData.type === 'travel') return;

    let locationInterval: NodeJS.Timeout;

    const setupLocationTracking = async () => {
      try {
        const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
        if (foreStatus !== "granted") {
          showToast("Location permission is required for home presence features.", "info");
          return;
        }

        const checkGeofence = async () => {
          if (!householdData?.info?.homeLocation) return;
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== "granted") return;

            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            // Geofence check against home coords with 100 meters radius tolerance
            const isInside = isInsideHomeRadius(
              loc.coords.latitude,
              loc.coords.longitude,
              householdData.info.homeLocation.latitude,
              householdData.info.homeLocation.longitude,
              100 
            );

            const nextStatus = isInside ? "home" : "out";
            const currentStatus = userData?.status || "home";
            const shouldUpdate =
              (nextStatus === "home" && currentStatus === "out") ||
              (nextStatus === "out" && currentStatus === "home");

            // Update user status if presence has crossed geofence boundary
            if (shouldUpdate) {
              const userDocRef = doc(db, "users", user.uid);
              await updateDoc(userDocRef, { status: nextStatus });
            }
          } catch (e) {
            console.warn("Geofence location check failed:", e);
          }
        };

        // Run immediately when dashboard loads
        await checkGeofence();

        // Run check periodically in the foreground every 45 seconds
        locationInterval = setInterval(checkGeofence, 45000);
      } catch (e) {
        console.warn("Failed to configure location tracking:", e);
      }
    };

    setupLocationTracking();

    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [user?.uid, householdId, householdData, userData?.status]);

  // Action: Links to native dialer layout to make a call
  const handlePhoneCall = useCallback(async (phone: string) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s+/g, "")}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Clipboard.setStringAsync(phone);
        showToast("Phone copied to clipboard", "success");
      }
    } catch {
      await Clipboard.setStringAsync(phone);
      showToast("Phone copied to clipboard", "success");
    }
  }, [showToast]);

  // Action: Open web links inside external browser
  const handleOpenLink = useCallback(async (link: string) => {
    if (!link) return;
    let formatted = link.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    try {
      const supported = await Linking.canOpenURL(formatted);
      if (supported) {
        await Linking.openURL(formatted);
      } else {
        await Clipboard.setStringAsync(link);
        showToast("Link copied to clipboard", "success");
      }
    } catch {
      await Clipboard.setStringAsync(link);
      showToast("Link copied to clipboard", "success");
    }
  }, [showToast]);

  // Navigation handlers
  const handleNav = useCallback((screenName: "Grocery" | "Expenses" | "Chores" | "Chat") => {
    navigation.navigate(screenName);
  }, [navigation]);

  const handleNavigateToSelection = useCallback(() => {
    navigation.navigate("HouseholdSelection");
  }, [navigation]);

  // Memoize greeting text string based on current clock hour
  const greeting = useMemo(() => {
    const hours = getSyncedDate().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Memoize info field contents fallback list
  const detailsList = useMemo(() => {
    return householdData?.info?.details && householdData.info.details.length > 0
      ? householdData.info.details
      : [
          {
            id: "wifi_net",
            label: "WiFi Network",
            value: householdData?.info?.wifiName || "Not Set",
            type: "text",
            icon: "wifi",
          },
          {
            id: "wifi_pass",
            label: "WiFi Password",
            value: householdData?.info?.wifiPass || "........",
            type: "password",
            icon: "vpn-key",
          },
          {
            id: "landlord_contact",
            label: "Landlord",
            value:
              householdData?.info?.landlordPhone ||
              householdData?.info?.landlordName ||
              "Not Set",
            type: "phone",
            icon: "phone-in-talk",
          },
          {
            id: "trash_truck",
            label: "Trash Truck",
            value: householdData?.info?.trashArrivalTime || "Not Set",
            type: "time",
            icon: "delete-outline",
          },
        ];
  }, [householdData?.info]);

  // Color tokens mapping
  const bgColors = isDark
    ? (["#070913", "#070913"] as const)
    : (["#ECEEFF", "#ECEEFF"] as const);
  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";
  const textMuted = isDark ? "#A78BFA" : "#4F46E5";
  const glassBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.1)";
  const glassBg = isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF";

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      {/* Decorative blurred background blobs */}
      <View
        style={{
          position: "absolute",
          top: -100,
          right: -50,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(99, 102, 241, 0.04)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 300,
          left: -100,
          width: 250,
          height: 250,
          borderRadius: 125,
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(99, 102, 241, 0.04)",
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Hub Header Bar */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Avatar block leading to Profile */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile")}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderWidth: 1.5,
                borderColor: "#4F46E5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar
                name={userData?.username || "U"}
                size={38}
                bgColor={isDark ? "#1E1B4B" : "#EEF2FF"}
                color={isDark ? "#A78BFA" : "#4F46E5"}
                photoUrl={userData?.photoUrl}
                style={{ borderRadius: 19 }}
              />
            </TouchableOpacity>
            
            {/* Household Switcher dropdown anchor */}
            <TouchableOpacity
              onPress={() => setIsHouseholdSwitcherVisible(true)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: isDark ? "#A78BFA" : "#4F46E5", textTransform: "uppercase", letterSpacing: 1 }}>
                    HOUSEHOLD HUB
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={14} color={isDark ? "#A78BFA" : "#4F46E5"} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "900", color: textMain, letterSpacing: -0.5, lineHeight: 26 }}>
                  {householdData?.name || "Loading..."}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Action buttons tray */}
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {/* Pin note button */}
            <TouchableOpacity
              onPress={() => {
                setStickyText(stickyNote?.text || "");
                setIsStickyModalVisible(true);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? "#1E1B4B" : "rgba(99, 102, 241, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="push-pin" size={20} color={isDark ? "#A78BFA" : "#4F46E5"} style={{ transform: [{ rotate: "45deg" }] }} />
            </TouchableOpacity>

            {/* Roommates button */}
            <TouchableOpacity
              onPress={() => setIsMembersModalVisible(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? "#1E1B4B" : "rgba(99, 102, 241, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="people" size={22} color={isDark ? "#A78BFA" : "#4F46E5"} />
            </TouchableOpacity>

            {/* Bell notification alerts button with unread counter */}
            <TouchableOpacity
              onPress={async () => {
                setIsNotificationsModalVisible(true);
                if (user?.uid) {
                  // Reset unread count indicators and record timestamp checks
                  const relevantNew = activities.filter(
                    (a) => a.userId !== user.uid && (!a.targetUid || a.targetUid === user.uid)
                  );
                  const latestTime = relevantNew.length > 0
                    ? (relevantNew[0].createdAt?.seconds ? relevantNew[0].createdAt.seconds * 1000 : Date.now())
                    : Date.now();
                  try {
                    await AsyncStorage.setItem(`lastSeenActivity_${user.uid}`, String(latestTime));
                    setLastSeenActivityTime(latestTime);
                  } catch (e) {
                    console.warn("Error updating lastSeenActivityTime:", e);
                  }
                }
                setUnreadActivityCount(0);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? "#1E1B4B" : "rgba(99, 102, 241, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={{ transform: [{ scale: bellAnim }] }}>
                <MaterialIcons
                  name="notifications"
                  size={22}
                  color={unreadActivityCount > 0 ? "#EF4444" : isDark ? "#A78BFA" : "#4F46E5"}
                />
                {unreadActivityCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      backgroundColor: "#EF4444",
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1.5,
                      borderColor: isDark ? "#1E1B4B" : "#FFFFFF",
                    }}
                  >
                    <Text style={{ color: "white", fontSize: 8, fontWeight: "900" }}>
                      {unreadActivityCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dashboard FlatList Layout Container */}
        <FlatList
          data={[]}
          renderItem={() => null}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Hero Greeting and status balances summary */}
              <HeroGreeting
                greeting={greeting}
                username={userData?.username || "Roommate"}
                agendaItemsLength={agendaItems.length}
                isDark={isDark}
                netBalance={netBalance}
                nextChore={nextChore}
                onMarkChoreDone={handleQuickChoreDone}
                onNudgeRoommate={handleQuickNudge}
                getMemberName={getMemberName}
                isTravel={isTravel}
              />

              {/* Quick action buttons tray drawer */}
              <QuickActions
                onQuickBuy={() => setIsQuickBuyVisible(true)}
                onSettleUp={() => setIsQuickSettleVisible(true)}
                onQuickExpense={() => setIsQuickExpenseVisible(true)}
                onQuickChore={() => setIsQuickChoreVisible(true)}
                isDark={isDark}
                isTravel={isTravel}
              />

              {isTravel ? (
                /* ─── TRAVEL TRIP MODE WIDGETS ──────────────────────────────── */
                <View style={{ paddingHorizontal: 20, gap: 16, marginBottom: 20 }}>
                  
                  {/* Trip Summary Card */}
                  <View
                    style={{
                      backgroundColor: glassBg,
                      borderRadius: 24,
                      padding: 20,
                      borderWidth: 1,
                      borderColor: glassBorder,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons name="card-travel" size={18} color="#6366F1" />
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#6366F1", textTransform: "uppercase", letterSpacing: 1.5 }}>
                          Trip Summary
                        </Text>
                      </View>
                      {isOwner && (
                        <TouchableOpacity
                          onPress={() => setIsTripDetailsModalVisible(true)}
                          style={{ backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "900", color: "#6366F1" }}>EDIT</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={{ fontSize: 18, fontWeight: "900", color: textMain, marginBottom: 8 }}>
                      ✈️ {householdData?.tripDetails?.destination || "Destination Not Set"}
                    </Text>

                    <Text style={{ fontSize: 13, fontWeight: "700", color: textMuted, marginBottom: 12 }}>
                      📅 {householdData?.tripDetails?.startDate || "TBD"} to {householdData?.tripDetails?.endDate || "TBD"}
                    </Text>

                    {/* Accommodation details summary */}
                    {householdData?.tripDetails?.hotelName && (
                      <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: glassBorder, paddingTop: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: textMain }}>
                          🏨 Stay: {householdData.tripDetails.hotelName}
                        </Text>
                        {householdData.tripDetails.hotelAddress && (
                          <Text style={{ fontSize: 11, color: textMuted }}>
                            📍 {householdData.tripDetails.hotelAddress}
                          </Text>
                        )}
                        {householdData.tripDetails.bookingRef && (
                          <Text style={{ fontSize: 11, color: textMuted }}>
                            🔑 Ref: {householdData.tripDetails.bookingRef}
                          </Text>
                        )}
                        {householdData.tripDetails.hotelPhone && (
                          <Text style={{ fontSize: 11, color: "#6366F1", fontWeight: "700" }}>
                            📞 {householdData.tripDetails.hotelPhone}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Trip Wrap slide modal trigger */}
                    <TouchableOpacity
                      onPress={() => setIsTravelWrapModalVisible(true)}
                      style={{
                        backgroundColor: "#6366F1",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 12,
                        borderRadius: 16,
                        marginTop: 16,
                      }}
                    >
                      <MaterialIcons name="card-giftcard" size={16} color="#FFF" />
                      <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>
                        View Trip Wrap & Share
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Collaborative Itinerary Timeline widget */}
                  <View
                    style={{
                      backgroundColor: glassBg,
                      borderRadius: 24,
                      padding: 20,
                      borderWidth: 1,
                      borderColor: glassBorder,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons name="event" size={18} color="#EC4899" />
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#EC4899", textTransform: "uppercase", letterSpacing: 1.5 }}>
                          Itinerary Timeline
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsItineraryModalVisible(true)}
                        style={{ backgroundColor: isDark ? "rgba(236,72,153,0.15)" : "#FDF2F8", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "900", color: "#EC4899" }}>ADD EVENT</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Proposed activities approval notifications (only visible to owner) */}
                    {isOwner && itinerary.filter(item => !item.approved).length > 0 && (
                      <View style={{ marginBottom: 14, backgroundColor: isDark ? "rgba(245,158,11,0.06)" : "#FEF8E7", borderRadius: 16, padding: 12, borderLeftWidth: 3, borderLeftColor: "#F59E0B" }}>
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#F59E0B", textTransform: "uppercase", marginBottom: 6 }}>
                          Proposed Activities ({itinerary.filter(item => !item.approved).length})
                        </Text>
                        {itinerary.filter(item => !item.approved).map((item) => (
                          <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ fontSize: 12, fontWeight: "800", color: textMain }}>
                                {item.activity} ({item.date} at {item.time})
                              </Text>
                              <Text style={{ fontSize: 10, color: textMuted }}>
                                Proposed by {getMemberName(item.proposedBy)}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              <TouchableOpacity onPress={() => handleApproveItineraryItem(item.id)} style={{ padding: 4, backgroundColor: "#10B981", borderRadius: 6 }}>
                                <MaterialIcons name="check" size={14} color="#FFF" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteItineraryItem(item.id)} style={{ padding: 4, backgroundColor: "#EF4444", borderRadius: 6 }}>
                                <MaterialIcons name="close" size={14} color="#FFF" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Approved activities timelines */}
                    {itinerary.filter(item => item.approved).length === 0 ? (
                      <Text style={{ fontSize: 12, color: textMuted, fontStyle: "italic", textAlign: "center", marginVertical: 10 }}>
                        No approved itinerary activities yet. Propose one!
                      </Text>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {itinerary.filter(item => item.approved).map((item, index, arr) => (
                          <View key={item.id} style={{ flexDirection: "row", gap: 12 }}>
                            {/* Vertical timeline divider line */}
                            <View style={{ alignItems: "center" }}>
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EC4899", marginTop: 4 }} />
                              {index < arr.length - 1 && (
                                <View style={{ width: 1.5, flex: 1, backgroundColor: glassBorder, marginVertical: 4 }} />
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                <Text style={{ fontSize: 11, fontWeight: "800", color: "#EC4899" }}>
                                  {item.date} · {item.time}
                                </Text>
                                {(isOwner || item.proposedBy === user?.uid) && (
                                  <TouchableOpacity onPress={() => handleDeleteItineraryItem(item.id)}>
                                    <MaterialIcons name="delete-outline" size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: "800", color: textMain, marginTop: 2 }}>
                                {item.activity}
                              </Text>
                              {item.notes ? (
                                <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                                  📝 {item.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Packing checklist widget */}
                  <View
                    style={{
                      backgroundColor: glassBg,
                      borderRadius: 24,
                      padding: 20,
                      borderWidth: 1,
                      borderColor: glassBorder,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialIcons name="playlist-add-check" size={18} color="#10B981" />
                        <Text style={{ fontSize: 10, fontWeight: "900", color: "#10B981", textTransform: "uppercase", letterSpacing: 1.5 }}>
                          Packing Checklist
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsPackingModalVisible(true)}
                        style={{ backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#E6FDF5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "900", color: "#10B981" }}>MANAGE</Text>
                      </TouchableOpacity>
                    </View>

                    {packingList.length === 0 ? (
                      <Text style={{ fontSize: 12, color: textMuted, fontStyle: "italic", textAlign: "center", marginVertical: 10 }}>
                        No items on the list. Tap Manage to add!
                      </Text>
                    ) : (
                      <View style={{ gap: 6 }}>
                        {packingList.slice(0, 3).map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => handleToggleItemPacking(item.id, !item.done)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
                          >
                            <MaterialIcons
                              name={item.done ? "check-box" : "check-box-outline-blank"}
                              size={18}
                              color={item.done ? "#10B981" : textMuted}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: item.done ? textMuted : textMain,
                                textDecorationLine: item.done ? "line-through" : "none",
                              }}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {packingList.length > 3 && (
                          <TouchableOpacity onPress={() => setIsPackingModalVisible(true)}>
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#10B981", marginTop: 4 }}>
                              + {packingList.length - 3} more items...
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                </View>
              ) : (
                /* ─── STANDARD ROOMMATE MODE WIDGETS ────────────────────────── */
                <>
                  {/* Shared Sticky Notice board card */}
                  {isStickyActive ? (
                    <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setStickyText(stickyNote?.text || "");
                          setStickyExpiry((stickyNote as any)?.expiryType || "never");
                          setIsStickyModalVisible(true);
                        }}
                        activeOpacity={0.9}
                        style={{
                          backgroundColor: isDark ? "rgba(245, 158, 11, 0.06)" : "#FFFDF0",
                          borderRadius: 24,
                          padding: 18,
                          borderWidth: 1,
                          borderColor: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.25)",
                          shadowColor: "#F59E0B",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: isDark ? 0.1 : 0.04,
                          shadowRadius: 8,
                          elevation: 2,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MaterialIcons name="push-pin" size={16} color="#F59E0B" style={{ transform: [{ rotate: "45deg" }] }} />
                            <Text style={{ fontSize: 10, fontWeight: "900", color: "#F59E0B", textTransform: "uppercase", letterSpacing: 1.5 }}>
                              Sticky Notice Board
                            </Text>
                          </View>
                          {stickyNote?.updatedBy && (
                            <Text style={{ fontSize: 9, fontWeight: "700", color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
                              {stickyNote.updatedBy} {stickyNote.updatedAt ? `· ${formatStickyTime(stickyNote.updatedAt)}` : ""}
                            </Text>
                          )}
                        </View>
                        <Text 
                          style={{ 
                            fontSize: 14, 
                            fontWeight: "700", 
                            color: textMain,
                            lineHeight: 20,
                            fontStyle: "normal"
                          }}
                        >
                          {stickyNote?.text}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Daily Briefing action items timeline */}
                  <View style={{ paddingHorizontal: 20, marginBottom: 20, marginTop: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <Text style={{ color: textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
                        ⚡ Daily Briefing
                      </Text>
                      {agendaItems.length > 0 && (
                        <View style={{ backgroundColor: "#EF4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                            {agendaItems.length} ACTION{agendaItems.length > 1 ? "S" : ""}
                          </Text>
                        </View>
                      )}
                    </View>

                    {agendaItems.length === 0 ? (
                      <View
                        style={{
                          backgroundColor: glassBg,
                          borderRadius: 24,
                          padding: 16,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          borderWidth: 1,
                          borderColor: glassBorder,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MaterialIcons name="done-all" size={20} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: textMain }}>
                            All Caught Up!
                          </Text>
                          <Text style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B" }}>
                            No pending chores or outstanding balances.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {agendaItems.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => handleNav(item.navTarget)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              padding: 16,
                              borderRadius: 24,
                              backgroundColor: glassBg,
                              borderWidth: 1,
                              borderColor: glassBorder,
                              shadowColor: "#4F46E5",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isDark ? 0 : 0.03,
                              shadowRadius: 6,
                              elevation: isDark ? 0 : 1,
                            }}
                          >
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 14,
                                backgroundColor: item.color + "18",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                              }}
                            >
                              <MaterialIcons name={item.icon} size={22} color={item.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "800", color: textMain }}>
                                {item.title}
                              </Text>
                              <Text style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B", marginTop: 2 }}>
                                {item.subtitle}
                              </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            !isTravel ? (
              <View style={{ marginTop: 10 }}>
                {/* Household Info Deck Title */}
                <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
                      ℹ️ Household Info
                    </Text>
                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditMode(true);
                          setIsInfoModalVisible(true);
                        }}
                        style={{
                          backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "#EEF2FF",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MaterialIcons name="edit" size={14} color="#6366F1" />
                        <Text style={{ fontSize: 11, fontWeight: "900", color: "#6366F1" }}>EDIT INFO</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Horizontal Deck listing custom Wifi/Landlord fields */}
                <InfoCardsDeck
                  detailsList={detailsList}
                  isDark={isDark}
                  revealedFields={revealedFields}
                  toggleFieldVisibility={toggleFieldVisibility}
                  handlePhoneCall={handlePhoneCall}
                  handleOpenLink={handleOpenLink}
                  showToast={showToast}
                />
              </View>
            ) : null
          }
        />

        {/* ─── OVERLAY MODALS REGISTERS ──────────────────────────────────────── */}

        {/* Quick actions overlays */}
        <QuickBuyModal
          visible={isQuickBuyVisible}
          onClose={() => setIsQuickBuyVisible(false)}
        />

        <QuickSettleModal
          visible={isQuickSettleVisible}
          onClose={() => setIsQuickSettleVisible(false)}
        />

        <QuickExpenseModal
          visible={isQuickExpenseVisible}
          onClose={() => setIsQuickExpenseVisible(false)}
        />

        <QuickChoreModal
          visible={isQuickChoreVisible}
          onClose={() => setIsQuickChoreVisible(false)}
        />

        {/* Roommates Profiles and Leaves Actions list */}
        <MembersModal
          visible={isMembersModalVisible}
          onClose={() => setIsMembersModalVisible(false)}
          householdData={householdData}
          memberProfiles={memberProfiles}
          currentUserId={user?.uid || ""}
          isOwner={isOwner}
          handleRemoveMember={handleRemoveMember}
          showToast={showToast}
        />

        {/* Activity Logs feed list */}
        <NotificationsModal
          visible={isNotificationsModalVisible}
          onClose={() => setIsNotificationsModalVisible(false)}
          agendaItems={agendaItems}
          activities={activities}
          currentUserId={user?.uid || ""}
          handleNav={handleNav}
          isDark={isDark}
        />

        {/* Info detail and deleting options setup */}
        <InfoEditModal
          visible={isInfoModalVisible}
          onClose={() => {
            setIsInfoModalVisible(false);
            setIsEditMode(false);
          }}
          isEditMode={isEditMode}
          householdData={householdData}
          handleUpdateInfo={handleUpdateInfo}
          handleDeleteHousehold={handleDeleteHousehold}
          infoModalTab={infoModalTab}
        />

        {/* Swaps household scopes */}
        <HouseholdSwitcherModal
          visible={isHouseholdSwitcherVisible}
          onClose={() => setIsHouseholdSwitcherVisible(false)}
          householdsList={householdsList}
          currentHouseholdId={hid}
          setHouseholdId={setHouseholdId}
          onNavigateToSelection={handleNavigateToSelection}
          isDark={isDark}
        />

        {/* Edit trip summaries parameters */}
        <TripDetailsEditModal
          visible={isTripDetailsModalVisible}
          onClose={() => setIsTripDetailsModalVisible(false)}
          tripDetails={householdData?.tripDetails}
          onSave={handleSaveTripDetails}
        />

        {/* Add timeline trip item */}
        <ItineraryEditModal
          visible={isItineraryModalVisible}
          onClose={() => setIsItineraryModalVisible(false)}
          isCreator={isOwner}
          onAdd={handleAddItineraryItem}
        />

        {/* Manage checklist columns */}
        <PackingEditModal
          visible={isPackingModalVisible}
          onClose={() => setIsPackingModalVisible(false)}
          packingList={packingList}
          onAddItem={handleAddItemPacking}
          onToggleItem={handleToggleItemPacking}
          onDeleteItem={handleDeleteItemPacking}
        />

        {/* Travel Trip wrap presentation */}
        <TravelWrapModal
          visible={isTravelWrapModalVisible}
          onClose={() => setIsTravelWrapModalVisible(false)}
          householdData={householdData}
          memberProfiles={memberProfiles}
          currentUserId={user?.uid || ""}
          itinerary={itinerary}
        />

        {/* Sticky Notice board custom configurations */}
        <SlideModal
          visible={isStickyModalVisible}
          onClose={() => setIsStickyModalVisible(false)}
          title="Edit Sticky Board"
        >
          <View className="gap-4 pb-2 pt-2">
            {/* Input announcement */}
            <View>
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
                Announcement Text
              </Text>
              <TextInput
                className="bg-surfaceRaised rounded-2xl p-4 text-textMain font-bold border border-border/50 text-base"
                placeholder="e.g. Gas cylinder arriving between 2-4 PM today..."
                placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                value={stickyText}
                onChangeText={setStickyText}
                multiline
                numberOfLines={4}
                maxLength={200}
                style={{ textAlignVertical: "top", minHeight: 100 }}
              />
              <Text style={{ alignSelf: "flex-end" }} className="text-[10px] text-textMuted font-bold mt-1 px-1">
                {stickyText.length}/200 characters
              </Text>
            </View>

            {/* Expiry selection settings */}
            <View className="mb-2">
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
                Auto-Expiry Duration
              </Text>
              <View className="flex-row gap-2">
                {[
                  { id: "never", label: "No Expiry" },
                  { id: "12h", label: "12 Hours" },
                  { id: "24h", label: "24 Hours" },
                  { id: "3d", label: "3 Days" },
                ].map((opt) => {
                  const isSelected = stickyExpiry === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setStickyExpiry(opt.id as any)}
                      className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                        isSelected ? "bg-amber-500/15 border-amber-500" : "bg-surfaceRaised border-border/50"
                      }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${
                        isSelected ? "text-amber-500" : "text-textMuted"
                      }`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Save trigger button */}
            <TouchableOpacity
              onPress={handleSaveStickyNote}
              className="bg-warning py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-black text-sm uppercase tracking-widest">
                Update Sticky Board
              </Text>
            </TouchableOpacity>
          </View>
        </SlideModal>

      </SafeAreaView>
    </LinearGradient>
  );
}
