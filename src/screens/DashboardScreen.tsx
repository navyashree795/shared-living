import React, { useState, useEffect, memo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  Image,
  Linking,
  Animated,
  Dimensions,
} from "react-native";
import { createAudioPlayer } from "expo-audio";
import { TimeWheelPicker } from "../components/TimeWheelPicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../firebaseConfig";
import { useUser } from "../context/UserContext";
import { useHousehold } from "../context/HouseholdContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { Card } from "../components/Card";
import { Avatar } from "../components/Avatar";
import SlideModal from "../components/SlideModal";
import { ActivitySkeleton, Skeleton } from "../components/Skeleton";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";
import { getActivityConfig, logActivity } from "../utils/activityUtils";
import { getSyncedDate } from "../utils/timeUtils";
import { checkAndDraftRecurringExpenses } from "../utils/expenseUtils";
import { getCycleStartDate, enforceDataRetentionPolicy } from "../utils/retentionUtils";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, Activity } from "../types";

type Props = { navigation: any; route?: any };

const NAV_ITEMS = [
  {
    name: "Grocery" as const,
    icon: "shopping-cart" as const,
    iconBg: "#065F46",
    cardBg: "#059669",
    subtitle: "Shared shopping list",
  },
  {
    name: "Expenses" as const,
    icon: "account-balance-wallet" as const,
    iconBg: "#5B21B6",
    cardBg: "#A78BFA",
    subtitle: "Split bills & balances",
  },
  {
    name: "Chores" as const,
    icon: "cleaning-services" as const,
    iconBg: "#92400E",
    cardBg: "#D97706",
    subtitle: "Assign household tasks",
  },
  {
    name: "Chat" as const,
    icon: "chat" as const,
    iconBg: "#1E3A5F",
    cardBg: "#2563EB",
    subtitle: "Discuss with roommates",
  },
];

export default function DashboardScreen({ navigation }: Props) {
  const { householdId, setHouseholdId } = useHousehold();
  const hid = householdId ?? "";
  const { isDark } = useTheme();
  const bg = isDark ? "#070913" : "#F4F7FF";
  const surface = isDark ? "#0E1324" : "#FFFFFF";
  const text = isDark ? "#F1F5F9" : "#0F172A";
  const muted = isDark ? "#A78BFA" : "#4F46E5";
  const bord = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(99, 102, 241, 0.08)";
  const { showToast } = useToast();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] =
    useState(false);
  const { user, profile: userData } = useUser();
  const { householdData, memberProfiles } = useHousehold();

  const [editUsername, setEditUsername] = useState(userData?.username || "");

  const [trashCountdown, setTrashCountdown] = useState<string | null>(null);
  const [trashReminderSent, setTrashReminderSent] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<
    "all" | "landlord" | "wifi" | "trash"
  >("all");
  const [isEditMode, setIsEditMode] = useState(false);
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  const toggleFieldVisibility = (id: string) => {
    setRevealedFields((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [chores, setChores] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadChores, setHasUnreadChores] = useState(false);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [lastSeenActivityTime, setLastSeenActivityTime] = useState<number | null>(null);

  const unreadCountRef = useRef(0);
  unreadCountRef.current = unreadActivityCount;

  const lastSeenRef = useRef<number | null>(null);
  lastSeenRef.current = lastSeenActivityTime;

  const bellAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (userData?.username) {
      setEditUsername(userData.username);
    }
  }, [userData?.username]);

  useEffect(() => {
    const loadLastSeen = async () => {
      try {
        const val = await AsyncStorage.getItem(`lastSeenActivity_${user?.uid}`);
        if (val) {
          const parsed = Number(val);
          setLastSeenActivityTime(parsed);
        } else {
          setLastSeenActivityTime(0);
        }
      } catch (e) {
        console.warn("Error loading lastSeenActivityTime:", e);
        setLastSeenActivityTime(0);
      }
    };
    if (user?.uid) {
      loadLastSeen();
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!householdId || !householdData) return;
    const startDay = householdData.billingCycleStartDay || 1;
    enforceDataRetentionPolicy(householdId, startDay);
  }, [householdId, householdData?.billingCycleStartDay]);

  const handleUpdateProfile = async () => {
    if (!editUsername.trim() || !auth.currentUser) {
      showToast("Enter valid username", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        username: editUsername.trim(),
      });
      setIsProfileModalVisible(false);
      showToast("Profile updated", "success");
    } catch (e: any) {
      showToast("Could not update profile", "error");
    }
  };

  useEffect(() => {
    if (!householdId) return;
    setLoadingActivities(true);
    const q = query(
      collection(db, "households", hid, "activities"),
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

        // Notification logic
        if (user?.uid) {
          const relevantNew = fetched.filter(
            (a) =>
              a.userId !== user.uid &&
              (!a.targetUid || a.targetUid === user.uid),
          );

          const currentLastSeen = lastSeenRef.current;
          if (currentLastSeen === null) {
            // Wait until AsyncStorage loading is complete
            return;
          }

          let newUnreadCount = 0;
          if (currentLastSeen === 0) {
            // First time or empty, initialize lastSeenTime to the newest activity's time
            const latestTime = relevantNew.length > 0
              ? (relevantNew[0].createdAt?.seconds ? relevantNew[0].createdAt.seconds * 1000 : Date.now())
              : Date.now();
            AsyncStorage.setItem(`lastSeenActivity_${user.uid}`, String(latestTime)).catch((err) =>
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
              try {
                const beep = createAudioPlayer({
                  uri: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
                });
                beep.play();
              } catch (e) {
                console.warn("Could not play notification beep", e);
              }

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
  }, [householdId, user?.uid]);

  // TRASH COUNTDOWN & NOTIFICATION LOGIC (NTP SYNCED)
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
        // Reset reminder flag once truck passes or is far away
        if (diff < 0 || diff > 15 * 60 * 1000) {
          setTrashReminderSent(false);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [householdData?.info, trashReminderSent, householdId]);

  useEffect(() => {
    if (!householdId || !user?.uid) return;
    const q = query(
      collection(db, "households", hid, "messages"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some((doc) => {
        const data = doc.data();
        return (
          data.senderId !== user.uid &&
          (!data.readBy || !data.readBy.includes(user.uid))
        );
      });
      setHasUnreadMessages(unread);
    });
    return unsub;
  }, [householdId, user?.uid]);

  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", hid, "chores"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setChores(fetched);
    });
    return unsub;
  }, [householdId, householdData?.billingCycleStartDay]);

  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", hid, "groceries"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setGroceries(fetched);
    });
    return unsub;
  }, [householdId, householdData?.billingCycleStartDay]);

  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, "households", hid, "expenses"),
      where("createdAt", ">=", Timestamp.fromDate(mainStartDate)),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setExpenses(fetched);
    });

    const qRecurring = query(
      collection(db, "households", hid, "expenses"),
      where("isRecurring", "==", true)
    );
    const unsubRecurring = onSnapshot(qRecurring, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      checkAndDraftRecurringExpenses(hid, fetched);
    });

    return () => {
      unsub();
      unsubRecurring();
    };
  }, [householdId, householdData?.billingCycleStartDay]);

  const agendaItems = React.useMemo(() => {
    const items: any[] = [];
    if (!user?.uid) return items;

    // 1. Chores
    const now = getSyncedDate();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
    const pendingChoresToday = chores.filter((c) => {
      if (c.done || c.assignedToUid !== user.uid) return false;
      if (c.targetDate) {
        const target = typeof c.targetDate.toDate === 'function' ? c.targetDate.toDate() : new Date(c.targetDate);
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
      if (m !== user.uid) peerBalances[m] = 0;
    });

    expenses.forEach((exp) => {
      if (exp.type === "expense" && exp.amount) {
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          exp.splitAmong.forEach((splitUid: string) => {
            if (splitUid !== exp.paidByUid) {
              if (splitUid === user.uid)
                peerBalances[exp.paidByUid] =
                  (peerBalances[exp.paidByUid] || 0) + share;
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
          peerBalances[exp.toReceivedUid] =
            (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        else if (exp.toReceivedUid === user.uid)
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
    user?.uid,
    householdData?.members,
    memberProfiles,
  ]);

  useEffect(() => {
    if (!householdId || !user?.uid) return;
    const q = query(
      collection(db, "households", hid, "chores"),
      where("assignedToUid", "==", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some((doc) => {
        const data = doc.data();
        return !data.seenBy || !data.seenBy.includes(user.uid);
      });
      setHasUnreadChores(unread);
    });
    return unsub;
  }, [householdId, user?.uid]);

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
            const profile = memberProfiles[chore.assignedToUid];
            const assigneeName = profile?.username
              ? `${profile.username}`
              : "Member";
            await updateDoc(doc(db, "households", hid, "chores", chore.id), {
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
          console.error("Error in Dashboard reminder engine:", e);
        }
      }
    };
    const interval = setInterval(checkUpcomingChores, 30000);
    return () => clearInterval(interval);
  }, [chores, householdId, memberProfiles]);

  const members = householdData?.members || [];
  const isOwner = householdData?.createdBy === auth.currentUser?.uid;

  const handleRemoveMember = async (memberUid: string) => {
    const profile = memberProfiles[memberUid];
    const name = profile?.username
      ? `${profile.username}`
      : profile?.email || "this member";
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
              showToast("Could not remove member", "error");
            }
          },
        },
      ],
    );
  };

  // Tab navigation — no params needed, householdId is in context
  const handleNav = (
    screenName: "Grocery" | "Expenses" | "Chores" | "Chat",
  ) => {
    navigation.navigate(screenName);
  };

  const [householdsList, setHouseholdsList] = useState<
    { id: string; name: string }[]
  >([]);
  const [isSwitchModalVisible, setIsSwitchModalVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "households"),
      where("members", "array-contains", user.uid),
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
  }, [user?.uid]);

  const handleUpdateInfo = async (updates: any) => {
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
      showToast("Could not update", "error");
    }
  };

  const bgColors = isDark
    ? (["#070913", "#070913"] as readonly [string, string])
    : (["#ECEEFF", "#ECEEFF"] as readonly [string, string]);
  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";
  const textMuted = isDark ? "#A78BFA" : "#4F46E5";
  const glassBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(99,102,241,0.1)";
  const glassBg = isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const blurTint = isDark ? "dark" : "light";

  const detailsList =
    householdData?.info?.details && householdData.info.details.length > 0
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

  const handlePhoneCall = async (phone: string) => {
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
  };

  const handleOpenLink = async (link: string) => {
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
  };

  const greeting = React.useMemo(() => {
    const hours = getSyncedDate().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      {/* Background decorative blobs matching reference image */}
      <View
        style={{
          position: "absolute",
          top: -100,
          right: -50,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.02)"
            : "rgba(99, 102, 241, 0.04)",
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
          backgroundColor: isDark
            ? "rgba(255,255,255,0.02)"
            : "rgba(99, 102, 241, 0.04)",
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header — matches reference: avatar circle, HOUSEHOLD HUB label, name, icons */}
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
            {/* Avatar with border circle like reference */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile")}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                borderWidth: 1.5,
                borderColor: isDark ? "#4F46E5" : "#4F46E5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar
                name={userData?.username || "U"}
                size={38}
                bgColor={isDark ? "#1E1B4B" : "#EEF2FF"}
                color={isDark ? "#A78BFA" : "#4F46E5"}
                style={{ borderRadius: 19 }}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSwitchModalVisible(true)}>
              {/* HOUSEHOLD HUB label with dropdown arrow */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: isDark ? "#A78BFA" : "#4F46E5",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  HOUSEHOLD HUB
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={14}
                  color={isDark ? "#A78BFA" : "#4F46E5"}
                />
              </View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: textMain,
                  letterSpacing: -0.5,
                  lineHeight: 26,
                }}
              >
                {householdData?.name || "Loading..."}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {/* Header icons in rounded capsules like reference */}
            <TouchableOpacity
              onPress={() => setIsMembersModalVisible(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark
                  ? "#1E1B4B"
                  : "rgba(99, 102, 241, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name="people"
                size={22}
                color={isDark ? "#A78BFA" : "#4F46E5"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                setIsNotificationsModalVisible(true);
                if (user?.uid) {
                  const relevantNew = activities.filter(
                    (a) =>
                      a.userId !== user.uid &&
                      (!a.targetUid || a.targetUid === user.uid),
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
                backgroundColor: isDark
                  ? "#1E1B4B"
                  : "rgba(99, 102, 241, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={{ transform: [{ scale: bellAnim }] }}>
                <MaterialIcons
                  name="notifications"
                  size={22}
                  color={
                    unreadActivityCount > 0
                      ? "#EF4444"
                      : isDark
                        ? "#A78BFA"
                        : "#4F46E5"
                  }
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
                    <Text
                      style={{ color: "white", fontSize: 8, fontWeight: "900" }}
                    >
                      {unreadActivityCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Hero Card */}
          <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 20 }}>
            <LinearGradient
              colors={isDark ? ["#1E1B4B", "#0F1320"] : ["#E8EAFF", "#FFFFFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 32,
                padding: 24,
                borderWidth: 1,
                borderColor: glassBorder,
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.04,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "900", color: isDark ? "#A78BFA" : "#4F46E5", textTransform: "uppercase", letterSpacing: 1.5 }}>
                    {greeting}
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: "900", color: textMain, marginTop: 4, letterSpacing: -0.5 }}>
                    @{userData?.username || "Roommate"}
                  </Text>
                </View>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "#EEF2FF", alignItems: "center", justifyContent: "center" }}>
                  <MaterialIcons name="wb-sunny" size={26} color="#FBBF24" />
                </View>
              </View>
              
              <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2FF", marginVertical: 18 }} />
              
              <Text style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#4F46E5", fontWeight: "700" }}>
                {agendaItems.length === 0 
                  ? "✨ All clean and clear! No urgent chores or debts left today."
                  : `⚠️ You have ${agendaItems.length} action item${agendaItems.length > 1 ? "s" : ""} requiring attention today.`
                }
              </Text>
            </LinearGradient>
          </View>
          {/* Daily Briefing Panel */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20, marginTop: 10 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: textMuted,
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                }}
              >
                ⚡ Daily Briefing
              </Text>
              {agendaItems.length > 0 && (
                <View
                  style={{
                    backgroundColor: "#EF4444",
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
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
                <View>
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
                    onPress={() => handleNav(item.navTarget as any)}
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
                      <MaterialIcons
                        name={item.icon}
                        size={22}
                        color={item.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: textMain,
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? "#94A3B8" : "#64748B",
                          marginTop: 2,
                        }}
                      >
                        {item.subtitle}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={18}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Recent Feed — vertical list of recent activities */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text
              style={{
                color: textMuted,
                fontSize: 11,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 12,
              }}
            >
              💬 Recent Feed
            </Text>
            
            {activities.length > 0 ? (
              <View style={{ gap: 10 }}>
                {activities.slice(0, 3).map((activity, idx) => {
                  const config = getActivityConfig(activity.type);
                  return (
                    <View
                      key={activity.id || idx}
                      style={{
                        backgroundColor: glassBg,
                        borderRadius: 20,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderWidth: 1,
                        borderColor: glassBorder,
                        shadowColor: "#4F46E5",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDark ? 0 : 0.02,
                        shadowRadius: 6,
                        elevation: 1,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: config.color + "18",
                          padding: 8,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons
                          name={config.icon}
                          size={18}
                          color={config.color}
                        />
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color: textMain,
                          }}
                          numberOfLines={1}
                        >
                          {activity.userName} {config.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: isDark ? "#94A3B8" : "#64748B",
                            marginTop: 2,
                          }}
                        >
                          {activity.title}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: glassBg,
                  borderRadius: 20,
                  padding: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: glassBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? "#64748B" : "#94A3B8",
                  }}
                >
                  No recent activity
                </Text>
              </View>
            )}
          </View>

          {/* Household Details Grid — clean card matching reference */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View
              style={{
                backgroundColor: isDark ? "#0E1324" : "#FFFFFF",
                borderRadius: 32,
                padding: 20,
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.3 : 0.04,
                shadowRadius: 16,
                elevation: 3,
                borderWidth: 1,
                borderColor: glassBorder,
              }}
            >
              {/* Title row */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 4,
                      height: 16,
                      backgroundColor: "#6366F1",
                      borderRadius: 2,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "900",
                      color: textMain,
                      textTransform: "uppercase",
                      letterSpacing: 1.2,
                    }}
                  >
                    Household Hub Info
                  </Text>
                </View>
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
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <MaterialIcons name="edit" size={14} color="#6366F1" />
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#6366F1' }}>EDIT</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Horizontal scroll of Fields */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
              >
                {detailsList.map((field: any) => {
                  return (
                    <View
                      key={field.id}
                      style={{
                        width: 155,
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.02)"
                          : "#F8FAFC",
                        borderRadius: 20,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
                        minHeight: 110,
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: isDark
                              ? "rgba(99,102,241,0.12)"
                              : "#EEF2FF",
                            padding: 8,
                            borderRadius: 12,
                          }}
                        >
                          <MaterialIcons
                            name={field.icon}
                            size={18}
                            color="#6366F1"
                          />
                        </View>
                        
                        <View style={{ flexDirection: "row", gap: 4 }}>
                          {field.type === "password" && (
                            <TouchableOpacity
                              onPress={() => toggleFieldVisibility(field.id)}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons
                                name={
                                  revealedFields.includes(field.id)
                                    ? "visibility"
                                    : "visibility-off"
                                }
                                size={16}
                                color="#6366F1"
                                style={{ opacity: 0.8 }}
                              />
                            </TouchableOpacity>
                          )}
                          {field.type === "link" ? (
                            <TouchableOpacity
                              onPress={() => handleOpenLink(field.value)}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons
                                name="link"
                                size={16}
                                color="#6366F1"
                                style={{ opacity: 0.8 }}
                              />
                            </TouchableOpacity>
                          ) : field.type === "phone" ? (
                            <TouchableOpacity
                              onPress={() => handlePhoneCall(field.value)}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons
                                name="call"
                                size={16}
                                color="#6366F1"
                                style={{ opacity: 0.8 }}
                              />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={async () => {
                                await Clipboard.setStringAsync(field.value);
                                showToast("Copied", "success");
                              }}
                              style={{ padding: 4 }}
                            >
                              <MaterialIcons
                                name="content-copy"
                                size={16}
                                color="#6366F1"
                                style={{ opacity: 0.8 }}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      
                      <View style={{ marginTop: 10 }}>
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "800",
                            color: isDark ? "#64748B" : "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 2,
                          }}
                        >
                          {field.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color: textMain,
                          }}
                          numberOfLines={1}
                        >
                          {field.type === "password" &&
                          !revealedFields.includes(field.id)
                            ? "••••••••"
                            : field.value}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        {/* Modals */}
        <SlideModal
          visible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          title="Menu"
        >
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                setIsProfileModalVisible(true);
              }}
              className="flex-row items-center gap-4 bg-surfaceRaised p-5 rounded-3xl border border-border/50"
            >
              <View className="bg-emerald-100 p-2.5 rounded-xl">
                <MaterialIcons name="person" size={22} color="#10B981" />
              </View>
              <View>
                <Text className="text-textMain font-black">My Profile</Text>
                <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  Edit display name
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                auth.signOut();
              }}
              className="flex-row items-center gap-4 bg-rose-50 p-5 rounded-3xl border border-rose-100 mt-2"
            >
              <View className="bg-rose-100 p-2.5 rounded-xl">
                <MaterialIcons name="logout" size={22} color="#EF4444" />
              </View>
              <View>
                <Text className="text-rose-600 font-black">Sign Out</Text>
                <Text className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  Exit account
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </SlideModal>

        {/* Members Modal */}
        <SlideModal
          visible={isMembersModalVisible}
          onClose={() => setIsMembersModalVisible(false)}
          title="House Team"
        >
          <View className="bg-indigo-600 rounded-[32px] p-6 mb-6 shadow-lg shadow-indigo-200">
            <Text className="text-white/70 text-[10px] font-bold uppercase tracking-[2px] mb-2">
              Invite Code
            </Text>
            <View className="flex-row justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
              <Text className="text-white text-2xl font-black tracking-[4px]">
                {householdData?.inviteCode}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  await Clipboard.setStringAsync(
                    householdData?.inviteCode || "",
                  );
                  showToast("Code copied", "success");
                }}
                className="bg-white/20 p-2 rounded-xl"
              >
                <MaterialIcons name="content-copy" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">
            Current Members
          </Text>
          <View className="gap-3 mb-6">
            {Object.entries(memberProfiles).map(
              ([uid, member]: [string, any]) => (
                <View
                  key={uid}
                  className="flex-row items-center gap-4 bg-surfaceRaised p-4 rounded-3xl border border-border/50"
                >
                  <Avatar
                    name={member.username || "Member"}
                    size={48}
                    bgColor="#FFFFFF"
                    color="#4F46E5"
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                    }}
                  />
                  <View className="flex-1">
                    <Text className="text-textMain font-black">
                      {member.username || "Unknown Member"}
                    </Text>
                    <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                      {uid === auth.currentUser?.uid ? "You" : "Member"}
                    </Text>
                  </View>
                  {isOwner && uid !== auth.currentUser?.uid && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(uid)}
                      className="p-2"
                    >
                      <MaterialIcons
                        name="person-remove"
                        size={20}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ),
            )}
          </View>
        </SlideModal>

        {/* Profile Edit Modal */}
        <SlideModal
          visible={isProfileModalVisible}
          onClose={() => setIsProfileModalVisible(false)}
          title="My Profile"
        >
          <View className="gap-6">
            <View>
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
                Display Name
              </Text>
              <TextInput
                className="bg-surfaceRaised rounded-[28px] p-5 text-textMain font-black border border-border/50"
                placeholder="Your Name"
                value={editUsername}
                onChangeText={setEditUsername}
              />
            </View>
            <TouchableOpacity
              onPress={handleUpdateProfile}
              className="bg-indigo-600 rounded-[28px] py-5 items-center shadow-lg shadow-indigo-200"
            >
              <Text className="text-white font-black text-base uppercase tracking-widest">
                Update Profile
              </Text>
            </TouchableOpacity>
          </View>
        </SlideModal>

        {/* Info Modal */}
        <SlideModal
          visible={isInfoModalVisible}
          onClose={() => {
            setIsInfoModalVisible(false);
            setIsEditMode(false);
          }}
          title={isEditMode ? "Edit Household" : "Household Info"}
          scrollEnabled={true}
        >
          <HouseholdInfoModalContent
            tab={infoModalTab}
            isEdit={isEditMode}
            data={householdData?.info}
            householdName={householdData?.name}
            onSave={handleUpdateInfo}
          />
        </SlideModal>

        {/* Switch Household Modal */}
        <SlideModal
          visible={isSwitchModalVisible}
          onClose={() => setIsSwitchModalVisible(false)}
          title="Switch Household"
        >
          <View style={{ gap: 12, paddingBottom: 24 }}>
            {householdsList.map((h) => (
              <TouchableOpacity
                key={h.id}
                onPress={() => {
                  setHouseholdId(h.id);
                  setIsSwitchModalVisible(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: h.id === householdId ? "#6366F1" : bord,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor:
                      h.id === householdId
                        ? "#6366F1"
                        : isDark
                          ? "#334155"
                          : "#E2E8F0",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <MaterialIcons
                    name="home"
                    size={20}
                    color={h.id === householdId ? "#FFFFFF" : muted}
                  />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: "700",
                    color:
                      h.id === householdId
                        ? isDark
                          ? "#F1F5F9"
                          : "#0F172A"
                        : text,
                  }}
                >
                  {h.name}
                </Text>
                {h.id === householdId && (
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color="#6366F1"
                  />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => {
                setIsSwitchModalVisible(false);
                navigation.navigate("HouseholdSelection");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                marginTop: 8,
                backgroundColor: isDark ? "#334155" : "#F1F5F9",
                borderRadius: 20,
                borderStyle: "dashed",
                borderWidth: 1,
                borderColor: muted,
              }}
            >
              <MaterialIcons
                name="add"
                size={20}
                color={muted}
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontSize: 15, fontWeight: "700", color: muted }}>
                Create or Join Another
              </Text>
            </TouchableOpacity>
          </View>
        </SlideModal>
        {/* Notifications Modal */}
        <SlideModal
          visible={isNotificationsModalVisible}
          onClose={() => setIsNotificationsModalVisible(false)}
          title="Notifications"
        >
          <ScrollView
            style={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Daily Agenda Section */}
            {agendaItems.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    color: textMuted,
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 10,
                    marginLeft: 4,
                  }}
                >
                  Daily Agenda
                </Text>
                <View style={{ gap: 10 }}>
                  {agendaItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        setIsNotificationsModalVisible(false);
                        handleNav(item.navTarget as any);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        borderRadius: 20,
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(99,102,241,0.03)",
                        borderWidth: 1,
                        borderColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(99,102,241,0.05)",
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: item.color + "20",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <MaterialIcons
                          name={item.icon as any}
                          size={20}
                          color={item.color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: textMain,
                            fontWeight: "800",
                            fontSize: 13,
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={{
                            color: textMuted,
                            fontSize: 11,
                            marginTop: 4,
                            fontWeight: "600",
                          }}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={20}
                        color={textMuted}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Activity Section */}
            <View>
              <Text
                style={{
                  color: textMuted,
                  fontSize: 10,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 10,
                  marginLeft: 4,
                }}
              >
                Recent Activity
              </Text>
              {activities.filter((a) => {
                const isFromOther = a.userId !== user?.uid;
                const isForMe = !a.targetUid || a.targetUid === user?.uid;
                return isFromOther && isForMe;
              }).length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <MaterialIcons
                    name="notifications-none"
                    size={48}
                    color={muted}
                    style={{ opacity: 0.5 }}
                  />
                  <Text style={{ color: muted, fontSize: 14, marginTop: 12 }}>
                    No new notifications from roommates
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {activities
                    .filter((a) => {
                      const isFromOther = a.userId !== user?.uid;
                      const isForMe = !a.targetUid || a.targetUid === user?.uid;
                      return isFromOther && isForMe;
                    }) // ONLY roommates' notifications in Bell icon, and only if for me
                    .map((item, idx) => {
                      const config = getActivityConfig(item.type);
                      return (
                        <View
                          key={item.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 16,
                            borderRadius: 20,
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.03)"
                              : "rgba(99,102,241,0.03)",
                            borderWidth: 1,
                            borderColor: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(99,102,241,0.05)",
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              backgroundColor: config.color + "20",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            <MaterialIcons
                              name={config.icon}
                              size={20}
                              color={config.color}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: textMain,
                                  fontWeight: "800",
                                  fontSize: 13,
                                }}
                              >
                                {item.userName}
                              </Text>
                              <Text
                                style={{
                                  color: textMuted,
                                  fontSize: 13,
                                  marginHorizontal: 4,
                                }}
                              >
                                {config.label}
                              </Text>
                              <Text
                                style={{
                                  color: textMain,
                                  fontWeight: "700",
                                  fontSize: 13,
                                }}
                              >
                                {item.title}
                              </Text>
                            </View>
                            <Text
                              style={{
                                color: textMuted,
                                fontSize: 10,
                                marginTop: 4,
                                fontWeight: "600",
                              }}
                            >
                              {item.createdAt?.seconds
                                ? new Date(
                                    item.createdAt.seconds * 1000,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  })
                                : "Just now"}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          </ScrollView>
        </SlideModal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const HouseholdInfoModalContent = memo(
  ({ tab, isEdit, data, householdName, onSave }: any) => {
    const { isDark } = useTheme();
    const { showToast } = useToast();
    const [name, setName] = useState(householdName || "");
    const [fields, setFields] = useState<any[]>(() => {
      if (data?.details && data.details.length > 0) return data.details;
      const initial = [];
      if (data?.wifiName)
        initial.push({
          id: "wifi_net",
          label: "WiFi Network",
          value: data.wifiName,
          type: "text",
          icon: "wifi",
        });
      if (data?.wifiPass)
        initial.push({
          id: "wifi_pass",
          label: "WiFi Password",
          value: data.wifiPass,
          type: "password",
          icon: "vpn-key",
        });
      if (data?.landlordName)
        initial.push({
          id: "landlord_contact",
          label: "Landlord",
          value: data.landlordName,
          type: "text",
          icon: "phone-in-talk",
        });
      if (data?.trashArrivalTime)
        initial.push({
          id: "trash_truck",
          label: "Trash Truck",
          value: data.trashArrivalTime,
          type: "time",
          icon: "delete-outline",
        });
      return initial;
    });

    const [activeTimePickerId, setActiveTimePickerId] = useState<string | null>(
      null,
    );
    const [revealedFields, setRevealedFields] = useState<string[]>([]);

    const toggleFieldVisibility = (id: string) => {
      setRevealedFields((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
      );
    };

    const handleSave = () => {
      const updates: any = { details: fields };

      // Fallback static values for backwards compatibility
      const wifiF = fields.find(
        (f) =>
          f.id === "wifi_net" ||
          f.label.toLowerCase().includes("network") ||
          f.label.toLowerCase().includes("wifi name"),
      );
      const passF = fields.find(
        (f) =>
          f.id === "wifi_pass" ||
          f.label.toLowerCase().includes("password") ||
          f.label.toLowerCase().includes("wifi pass"),
      );
      const landF = fields.find(
        (f) =>
          f.id === "landlord_contact" ||
          f.label.toLowerCase().includes("landlord"),
      );
      const trashF = fields.find(
        (f) => f.type === "time" && f.icon === "delete-outline",
      );

      updates.wifiName = wifiF ? wifiF.value : "";
      updates.wifiPass = passF ? passF.value : "";
      updates.landlordName = landF ? landF.value : "";
      updates.trashArrivalTime = trashF ? trashF.value : "";

      onSave({ name: name.trim() || "My Household", info: updates });
    };

    const handleAddField = () => {
      setFields((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          label: "",
          value: "",
          type: "text",
          icon: "description",
        },
      ]);
    };

    const handleDeleteField = (id: string) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
    };

    const handleUpdateField = (id: string, updates: any) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      );
    };

    const copyToClipboard = async (text: string) => {
      if (!text) return;
      await Clipboard.setStringAsync(text);
      showToast("Copied to clipboard", "success");
    };

    const handlePhoneCall = async (phone: string) => {
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
    };

    const handleOpenLink = async (link: string) => {
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
    };

    const textMain = isDark ? "#F1F5F9" : "#1E1B4B";

    if (isEdit) {
      return (
        <>
          <View style={{ marginBottom: 16 }}>
            <View style={{ gap: 16, paddingBottom: 24 }}>
              {/* Household Name */}
              <View
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.02)",
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.04)",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: isDark ? "#A78BFA" : "#4F46E5",
                    textTransform: "uppercase",
                    marginBottom: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  Household Name
                </Text>
                <TextInput
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: isDark ? "#F1F5F9" : "#1E1B4B",
                    backgroundColor: isDark ? "#070913" : "#FFFFFF",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.08)",
                  }}
                  placeholder="e.g. My Flat"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Dynamic Fields List */}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  color: isDark ? "#94A3B8" : "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginTop: 8,
                  marginLeft: 4,
                }}
              >
                Custom Fields
              </Text>

              {fields.map((field) => (
                <View
                  key={field.id}
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                    padding: 14,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.04)",
                    gap: 10,
                  }}
                >
                  {/* Inputs Row */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: "800",
                        color: isDark ? "#F1F5F9" : "#1E1B4B",
                        backgroundColor: isDark ? "#070913" : "#FFFFFF",
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                      }}
                      placeholder="Label (e.g. WiFi Network)"
                      value={field.label}
                      onChangeText={(v) =>
                        handleUpdateField(field.id, { label: v })
                      }
                    />
                    {field.type === "time" ? (
                      <TouchableOpacity
                        onPress={() => setActiveTimePickerId(field.id)}
                        style={{
                          flex: 1.2,
                          height: 42,
                          backgroundColor: isDark ? "#070913" : "#FFFFFF",
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.06)",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: field.value
                              ? isDark
                                ? "#FBBF24"
                                : "#D97706"
                              : "#94A3B8",
                          }}
                        >
                          {field.value || "Set Time"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TextInput
                        style={{
                          flex: 1.2,
                          fontSize: 13,
                          fontWeight: "700",
                          color: isDark ? "#FBBF24" : "#1E1B4B",
                          backgroundColor: isDark ? "#070913" : "#FFFFFF",
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.06)",
                        }}
                        placeholder="Value"
                        value={field.value}
                        onChangeText={(v) =>
                          handleUpdateField(field.id, { value: v })
                        }
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => handleDeleteField(field.id)}
                      style={{
                        padding: 8,
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        borderRadius: 10,
                      }}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={18}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Type Selection pills */}
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {[
                      { type: "text", label: "Text", icon: "description" },
                      { type: "password", label: "Password", icon: "vpn-key" },
                      { type: "time", label: "Time", icon: "delete-outline" },
                      { type: "phone", label: "Phone", icon: "call" },
                      { type: "link", label: "Link", icon: "link" },
                    ].map((t) => (
                      <TouchableOpacity
                        key={t.type}
                        onPress={() => {
                          handleUpdateField(field.id, {
                            type: t.type,
                            icon: t.icon,
                          });
                          if (t.type === "time")
                            setActiveTimePickerId(field.id);
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor:
                            field.type === t.type
                              ? isDark
                                ? "rgba(192, 132, 252, 0.22)"
                                : "rgba(99, 102, 241, 0.12)"
                              : "transparent",
                          borderWidth: 1,
                          borderColor:
                            field.type === t.type
                              ? isDark
                                ? "#C084FC"
                                : "#4F46E5"
                              : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color:
                              field.type === t.type
                                ? isDark
                                  ? "#C084FC"
                                  : "#4F46E5"
                                : isDark
                                  ? "#94A3B8"
                                  : "#64748B",
                          }}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Nested TimePicker Modal */}
                  {activeTimePickerId === field.id && (
                    <Modal
                      visible={activeTimePickerId === field.id}
                      transparent
                      animationType="fade"
                    >
                      <TouchableOpacity
                        className="flex-1 bg-black/40 justify-center items-center px-6"
                        activeOpacity={1}
                        onPress={() => setActiveTimePickerId(null)}
                      >
                        <TouchableOpacity
                          activeOpacity={1}
                          className="w-full bg-surface rounded-[32px] p-6 shadow-2xl"
                          onPress={(e) => e.stopPropagation()}
                        >
                          <TimeWheelPicker
                            initialTime={(() => {
                              if (
                                !field.value ||
                                typeof field.value !== "string" ||
                                !field.value.includes(":")
                              )
                                return getSyncedDate();
                              const parts = field.value.split(":").map(Number);
                              const h = parts[0];
                              const m = parts[1];
                              if (isNaN(h) || isNaN(m)) return getSyncedDate();
                              const d = getSyncedDate();
                              d.setHours(h, m, 0, 0);
                              return d;
                            })()}
                            onConfirm={(date) => {
                              const hours = date
                                .getHours()
                                .toString()
                                .padStart(2, "0");
                              const minutes = date
                                .getMinutes()
                                .toString()
                                .padStart(2, "0");
                              handleUpdateField(field.id, {
                                value: `${hours}:${minutes}`,
                              });
                              setActiveTimePickerId(null);
                            }}
                            onCancel={() => setActiveTimePickerId(null)}
                          />
                          <TouchableOpacity
                            onPress={() => setActiveTimePickerId(null)}
                            className="mt-4 py-3 items-center"
                          >
                            <Text className="text-textMuted font-bold text-sm">
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Modal>
                  )}
                </View>
              ))}

              {/* Add Field Button */}
              <TouchableOpacity
                onPress={handleAddField}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                  backgroundColor: isDark
                    ? "rgba(192, 132, 252, 0.12)"
                    : "rgba(99, 102, 241, 0.06)",
                  borderRadius: 16,
                  borderStyle: "dashed",
                  borderWidth: 1,
                  borderColor: isDark ? "#C084FC" : "#4F46E5",
                  marginTop: 6,
                }}
              >
                <MaterialIcons
                  name="add"
                  size={18}
                  color={isDark ? "#C084FC" : "#4F46E5"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: isDark ? "#C084FC" : "#4F46E5",
                  }}
                >
                  Add Custom Field
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            className="bg-indigo-600 rounded-2xl py-4 items-center shadow-lg shadow-indigo-300 mb-8"
          >
            <Text className="text-white font-black text-lg">Save Changes</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <View style={{ marginBottom: 16 }}>
          <View style={{ gap: 12, paddingBottom: 24 }}>
            {fields.length > 0 ? (
              fields.map((field) => (
                <View
                  key={field.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.02)",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                      marginRight: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isDark
                          ? "rgba(192, 132, 252, 0.15)"
                          : "rgba(99, 102, 241, 0.08)",
                        padding: 8,
                        borderRadius: 12,
                      }}
                    >
                      <MaterialIcons
                        name={field.icon || "description"}
                        size={18}
                        color={isDark ? "#C084FC" : "#4F46E5"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          color: isDark ? "#94A3B8" : "#64748B",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {field.label}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: textMain,
                        }}
                      >
                        {field.type === "password" && field.value
                          ? revealedFields.includes(field.id)
                            ? field.value
                            : "••••••••"
                          : field.value || "Not Set"}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Based on Type */}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {field.type === "password" && field.value ? (
                      <>
                        <TouchableOpacity
                          onPress={() => toggleFieldVisibility(field.id)}
                          style={{
                            padding: 7,
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.04)",
                            borderRadius: 10,
                          }}
                        >
                          <MaterialIcons
                            name={
                              revealedFields.includes(field.id)
                                ? "visibility"
                                : "visibility-off"
                            }
                            size={14}
                            color={isDark ? "#A78BFA" : "#4F46E5"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => copyToClipboard(field.value)}
                          style={{
                            padding: 7,
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(0,0,0,0.04)",
                            borderRadius: 10,
                          }}
                        >
                          <MaterialIcons
                            name="content-copy"
                            size={14}
                            color={isDark ? "#A78BFA" : "#4F46E5"}
                          />
                        </TouchableOpacity>
                      </>
                    ) : null}
                    {field.type === "phone" && field.value ? (
                      <TouchableOpacity
                        onPress={() => handlePhoneCall(field.value)}
                        style={{
                          padding: 7,
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.04)",
                          borderRadius: 10,
                        }}
                      >
                        <MaterialIcons
                          name="call"
                          size={14}
                          color={isDark ? "#A78BFA" : "#4F46E5"}
                        />
                      </TouchableOpacity>
                    ) : null}
                    {field.type === "link" && field.value ? (
                      <TouchableOpacity
                        onPress={() => handleOpenLink(field.value)}
                        style={{
                          padding: 7,
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.04)",
                          borderRadius: 10,
                        }}
                      >
                        <MaterialIcons
                          name="link"
                          size={14}
                          color={isDark ? "#A78BFA" : "#4F46E5"}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isDark ? "#94A3B8" : "#64748B",
                  }}
                >
                  No custom fields added yet. Tap Edit to begin!
                </Text>
              </View>
            )}
          </View>
        </View>
      </>
    );
  },
);
HouseholdInfoModalContent.displayName = "HouseholdInfoModalContent";
