import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
  Linking,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { createAudioPlayer } from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
} from "firebase/firestore";
import { scheduleChoreReminder, cancelChoreReminder } from "../utils/notificationUtils";
import { logActivity, getActivityConfig } from "../utils/activityUtils";
import { db, auth } from "../firebaseConfig";
import { useUser } from "../context/UserContext";
import { useHousehold } from "../context/HouseholdContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { Avatar } from "../components/Avatar";
import { Activity } from "../types";
import { getSyncedDate } from "../utils/timeUtils";

// Custom hooks and modular components
import { useDashboardData } from "../hooks/useDashboardData";
import { HeroGreeting } from "../components/dashboard/HeroGreeting";
import { InfoCardsDeck } from "../components/dashboard/InfoCardsDeck";
import { QuickActions } from "../components/dashboard/QuickActions";
import SlideModal from "../components/SlideModal";
import { MembersModal } from "../components/modals/MembersModal";
import { NotificationsModal } from "../components/modals/NotificationsModal";
import { InfoEditModal } from "../components/modals/InfoEditModal";
import { QuickBuyModal } from "../components/modals/QuickBuyModal";
import { QuickSettleModal } from "../components/modals/QuickSettleModal";
import { QuickExpenseModal } from "../components/modals/QuickExpenseModal";
import { QuickChoreModal } from "../components/modals/QuickChoreModal";
import * as Location from "expo-location";
import { isInsideHomeRadius } from "../utils/locationUtils";

type Props = { navigation: any; route?: any };

export default function DashboardScreen({ navigation }: Props) {
  const { householdId, setHouseholdId } = useHousehold();
  const hid = householdId ?? "";
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { user, profile: userData } = useUser();
  const { householdData, memberProfiles, getMemberName, members } = useHousehold();

  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);

  const [isQuickBuyVisible, setIsQuickBuyVisible] = useState(false);
  const [isQuickSettleVisible, setIsQuickSettleVisible] = useState(false);
  const [isQuickExpenseVisible, setIsQuickExpenseVisible] = useState(false);
  const [isQuickChoreVisible, setIsQuickChoreVisible] = useState(false);

  const [stickyNote, setStickyNote] = useState<{ text: string; updatedBy: string; updatedAt: any } | null>(null);
  const [isStickyModalVisible, setIsStickyModalVisible] = useState(false);
  const [stickyText, setStickyText] = useState("");
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);

  const infoModalTab = "all";
  const [isEditMode, setIsEditMode] = useState(false);
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  const toggleFieldVisibility = useCallback((id: string) => {
    setRevealedFields((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const bellAnim = useRef(new Animated.Value(1)).current;

  // Sound and animation notification trigger callback
  const handleNewUnreadActivity = useCallback(() => {
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
  }, [bellAnim]);

  // Aggregate Firestore data-listeners and timer background checks
  const {
    activities,
    chores,
    expenses,
    agendaItems,
    householdsList,
    unreadActivityCount,
    setLastSeenActivityTime,
    setUnreadActivityCount,
  } = useDashboardData({
    userId: user?.uid,
    householdId,
    householdData,
    memberProfiles,
    onNewUnreadActivity: handleNewUnreadActivity,
  });

  // Calculate Net Balancing Standings (positive = roommates owe user, negative = user owes roommates)
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

    const sum = Object.values(peerBalances).reduce((acc, val) => acc + val, 0);
    return -sum;
  }, [expenses, members, user?.uid]);

  // Retrieve next active chore today
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
    return myChore || roommateChore || null;
  }, [chores, user?.uid]);

  // Callback to mark chore as completed directly from the Greeting Card
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

      // Rotation logic if enabled
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
          createdByUid: chore.createdByUid || auth.currentUser?.uid || "",
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
  }, [householdId, showToast, getMemberName]);

  // Callback to nudge a roommate directly from the Greeting Card
  const handleQuickNudge = useCallback(async (chore: any) => {
    if (!householdId) return;
    try {
      await logActivity(householdId, "chore_reminder", chore.title, undefined, 0, chore.assignedToUid);
      showToast("Nudge sent!", "success");
    } catch (error) {
      console.error("Quick Nudge Error:", error);
    }
  }, [householdId, showToast]);

  const isOwner = householdData?.createdBy === auth.currentUser?.uid;

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


  // Sticky Board listener
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

  const formatStickyTime = useCallback((timestamp: any) => {
    if (!timestamp) return "";
    try {
      const d = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, []);

  const handleSaveStickyNote = useCallback(async () => {
    if (!hid) return;
    try {
      const docRef = doc(db, "households", hid, "announcements", "sticky");
      await setDoc(docRef, {
        text: stickyText.trim(),
        updatedBy: userData?.username || "Roommate",
        updatedAt: serverTimestamp(),
      });
      setIsStickyModalVisible(false);
      showToast("Sticky note updated", "success");
    } catch (e) {
      console.error("Error saving sticky note:", e);
      showToast("Could not update note", "error");
    }
  }, [hid, stickyText, userData?.username, showToast]);

  const handleUpdateStatus = useCallback(async (newStatus: "home" | "out" | "sleeping" | "away") => {
    if (!user?.uid) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { status: newStatus });
      setIsStatusModalVisible(false);
      const statusTextMap = {
        home: "At Home",
        out: "Out / Busy",
        sleeping: "Sleeping",
        away: "Away (Vacation)"
      };
      showToast(`Status updated to ${statusTextMap[newStatus]}`, "success");
    } catch (e) {
      console.error("Error updating status:", e);
      showToast("Could not update status", "error");
    }
  }, [user?.uid, showToast]);
 
  // 1. Request location permissions and auto-pin location for owner if not set
  useEffect(() => {
    if (!user?.uid || !householdId || !householdData) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const isOwner = householdData.createdBy === user.uid;
          if (isOwner && !householdData.info?.homeLocation) {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Highest,
            });
            const homeLocation = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            const householdDocRef = doc(db, "households", householdId);
            const currentInfo = householdData.info || {};
            await updateDoc(householdDocRef, {
              info: {
                ...currentInfo,
                homeLocation,
              },
            });
            showToast("📍 Automatically pinned your location as the household home location!", "success");
          }
        } else {
          showToast("Location permission is required for home presence features.", "info");
        }
      } catch (e) {
        console.warn("Failed to request location / auto-pin on mount:", e);
      }
    })();
  }, [user?.uid, householdId, householdData]);

  // 2. Dynamic GPS Presence Geofencing Tracker
  useEffect(() => {
    if (!user?.uid || !householdId || !householdData?.info?.homeLocation) return;

    const homeLocation = householdData.info.homeLocation;
    let locationInterval: NodeJS.Timeout;

    const checkGeofence = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const isInside = isInsideHomeRadius(
          loc.coords.latitude,
          loc.coords.longitude,
          homeLocation.latitude,
          homeLocation.longitude,
          100 // 100 meters radius
        );

        const nextStatus = isInside ? "home" : "out";
        const currentStatus = userData?.status || "home";
        if (currentStatus !== nextStatus) {
          // If the status has actually changed based on location, update it!
          if (currentStatus === "home" || currentStatus === "out") {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { status: nextStatus });
          }
        }
      } catch (e) {
        console.warn("Geofence location check failed:", e);
      }
    };

    // Run immediately on load/mount
    checkGeofence();

    // Check periodically every 60 seconds
    locationInterval = setInterval(checkGeofence, 60000);

    return () => {
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [user?.uid, householdId, householdData?.info?.homeLocation, userData?.status]);



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

  const handleNav = useCallback((screenName: "Grocery" | "Expenses" | "Chores" | "Chat") => {
    navigation.navigate(screenName);
  }, [navigation]);

  const handleNavigateToSelection = useCallback(() => {
    navigation.navigate("HouseholdSelection");
  }, [navigation]);

  const greeting = useMemo(() => {
    const hours = getSyncedDate().getHours();
    if (hours < 12) return "Good Morning";
    if (hours < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

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

  const bgColors = isDark
    ? (["#070913", "#070913"] as const)
    : (["#ECEEFF", "#ECEEFF"] as const);
  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";
  const textMuted = isDark ? "#A78BFA" : "#4F46E5";
  const glassBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.1)";
  const glassBg = isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF";

  const renderActivityItem = useCallback(({ item }: { item: Activity }) => {
    const config = getActivityConfig(item.type);
    return (
      <View
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
          marginHorizontal: 20,
          marginBottom: 10,
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
          <MaterialIcons name={config.icon} size={18} color={config.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "900", color: textMain }} numberOfLines={1}>
            {item.userName} {config.label}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? "#94A3B8" : "#64748B", marginTop: 2 }}>
            {item.title}
          </Text>
        </View>
      </View>
    );
  }, [isDark, glassBg, glassBorder, textMain]);

  const renderEmptyActivities = useCallback(() => (
    <View
      style={{
        backgroundColor: glassBg,
        borderRadius: 20,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: glassBorder,
        marginHorizontal: 20,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 12, color: isDark ? "#64748B" : "#94A3B8" }}>
        No recent activity
      </Text>
    </View>
  ), [isDark, glassBg, glassBorder]);

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      {/* Background decorative blobs */}
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
        {/* Header */}
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
                style={{ borderRadius: 19 }}
              />
            </TouchableOpacity>
            
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: isDark ? "#A78BFA" : "#4F46E5", textTransform: "uppercase", letterSpacing: 1 }}>
                  HOUSEHOLD HUB
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: textMain, letterSpacing: -0.5, lineHeight: 26 }}>
                {householdData?.name || "Loading..."}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
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

            <TouchableOpacity
              onPress={async () => {
                setIsNotificationsModalVisible(true);
                if (user?.uid) {
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

        {/* Unified FlatList layout representing root view */}
        <FlatList
          data={activities.slice(0, 3)}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderActivityItem}
          ListEmptyComponent={renderEmptyActivities}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Welcome Hero */}
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
              />

              {/* Quick Actions Tray */}
              <QuickActions
                onQuickBuy={() => setIsQuickBuyVisible(true)}
                onSettleUp={() => setIsQuickSettleVisible(true)}
                onQuickExpense={() => setIsQuickExpenseVisible(true)}
                onQuickChore={() => setIsQuickChoreVisible(true)}
                isDark={isDark}
              />

              {/* Shared Sticky Notice Board */}
              <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    setStickyText(stickyNote?.text || "");
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
                      color: stickyNote?.text ? textMain : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)"),
                      lineHeight: 20,
                      fontStyle: stickyNote?.text ? "normal" : "italic"
                    }}
                  >
                    {stickyNote?.text || "No active announcements. Tap here to write a note! 📌"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Daily Briefing Panel */}
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

              {/* Recent Feed Section Header */}
              <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <Text style={{ color: textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
                  💬 Recent Feed
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={
            <View style={{ marginTop: 10 }}>
              {/* Household Details Section Header */}
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

              {/* Horizontally scrolling list of fields */}
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
          }
        />

        {/* Modals */}

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

        <NotificationsModal
          visible={isNotificationsModalVisible}
          onClose={() => setIsNotificationsModalVisible(false)}
          agendaItems={agendaItems}
          activities={activities}
          currentUserId={user?.uid || ""}
          handleNav={handleNav}
          isDark={isDark}
        />

        <InfoEditModal
          visible={isInfoModalVisible}
          onClose={() => {
            setIsInfoModalVisible(false);
            setIsEditMode(false);
          }}
          isEditMode={isEditMode}
          householdData={householdData}
          handleUpdateInfo={handleUpdateInfo}
          infoModalTab={infoModalTab}
        />

        {/* Sticky Note Edit Modal */}
        <SlideModal
          visible={isStickyModalVisible}
          onClose={() => setIsStickyModalVisible(false)}
          title="Edit Sticky Board"
        >
          <View className="gap-4 pb-2 pt-2">
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

        {/* Quick Status Modal */}
        <SlideModal
          visible={isStatusModalVisible}
          onClose={() => setIsStatusModalVisible(false)}
          title="Update My Status"
        >
          <View className="gap-3 pb-2 pt-2">
            {[
              { id: "home", label: "At Home", emoji: "🟢", desc: "You are in the flat and available" },
              { id: "out", label: "Out / Busy", emoji: "🟡", desc: "You are outside or occupied" },
              { id: "sleeping", label: "Sleeping", emoji: "💤", desc: "Do not disturb" },
              { id: "away", label: "Away (Vacation)", emoji: "✈️", desc: "Away for a longer trip" }
            ].map(item => {
              const currentStatus = memberProfiles[user?.uid || ""]?.status || "home";
              const isSelected = currentStatus === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleUpdateStatus(item.id as any)}
                  className={`flex-row items-center p-3 rounded-2xl border ${isSelected ? 'bg-indigo-600/10 border-indigo-600' : 'bg-surfaceRaised border-border/50'}`}
                >
                  <Text className="text-xl mr-4">{item.emoji}</Text>
                  <View className="flex-1">
                    <Text className={`font-black text-sm ${isSelected ? 'text-indigo-600' : 'text-textMain'}`}>{item.label}</Text>
                    <Text className="text-[10px] text-textMuted font-medium mt-0.5">{item.desc}</Text>
                  </View>
                  {isSelected && <MaterialIcons name="check" size={18} color="#4F46E5" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </SlideModal>
      </SafeAreaView>
    </LinearGradient>
  );
}
