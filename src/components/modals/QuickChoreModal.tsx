import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { useUser } from "../../context/UserContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { logActivity } from "../../utils/activityUtils";
import { getSyncedDate, getNextOccurrence } from "../../utils/timeUtils";
import { scheduleChoreReminder } from "../../utils/notificationUtils";
import SlideModal from "../SlideModal";

interface QuickChoreModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QuickChoreModal = React.memo(({ visible, onClose }: QuickChoreModalProps) => {
  const { householdId, members, getMemberName } = useHousehold();
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setAssignedTo(auth.currentUser?.uid || "");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [visible]);

  const handleSave = async () => {
    const choreTitle = title.trim();
    if (!choreTitle) {
      Alert.alert("Error", "Please enter a chore title.");
      return;
    }
    if (!assignedTo) {
      Alert.alert("Error", "Please assign the chore to someone.");
      return;
    }
    if (!householdId) return;

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const now = getSyncedDate();
    // Default chore time to 8:00 PM for today
    const formattedTime = "08:00 PM";
    const today = now.toLocaleDateString("en-US", { weekday: "short" }); // e.g. "Mon"
    const nextTarget = getNextOccurrence(today, formattedTime);
    const currentUserName = userData?.username
      ? userData.username
      : auth.currentUser?.email?.split("@")[0] || "Member";

    try {
      const notifId = await scheduleChoreReminder(choreTitle, nextTarget);

      await addDoc(collection(db, "households", householdId, "chores"), {
        title: choreTitle,
        assignedToUid: assignedTo,
        time: formattedTime,
        rotationEnabled: false,
        rotationOrder: [],
        day: today,
        done: false,
        createdByUid: currentUid,
        createdAt: serverTimestamp(),
        currentRotationIndex: 0,
        seenBy: [currentUid],
        targetDate: Timestamp.fromDate(nextTarget),
        notificationId: notifId || null,
      });

      logActivity(householdId, "chore_add", choreTitle, currentUserName);
      showToast("Chore added successfully", "success");

      onClose();
    } catch (err) {
      console.error("Error logging quick chore:", err);
      Alert.alert("Error", "Could not add chore.");
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#0F172A";
  const border = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const inputBg = isDark ? "#0F172A" : "#F8FAFC";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const primary = isDark ? "#818CF8" : "#4F46E5";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Log Chore for Today">
      <View style={{ gap: 20 }}>
        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            What needs to be done?
          </Text>
          <TextInput
            ref={inputRef}
            style={{ backgroundColor: inputBg, borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: border }}
            placeholder="e.g. Wash dishes, Water plants"
            placeholderTextColor={textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>
            Assign to
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -10, paddingHorizontal: 10 }}>
            {members.map((uid) => {
              const name = getMemberName(uid);
              const isSelected = assignedTo === uid;
              return (
                <TouchableOpacity
                  key={uid}
                  onPress={() => setAssignedTo(uid)}
                  style={{
                    alignItems: "center",
                    marginRight: 16,
                    padding: 12,
                    borderRadius: 20,
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(99, 102, 241, 0.1)"
                        : "#EEF2FF"
                      : "transparent",
                    borderWidth: 1,
                    borderColor: isSelected ? primary : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 18,
                      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "900", color: primary }}>
                      {name.replace("@", "")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: textMain }}>
                    {name.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "#FFFBEB", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.1)" }}>
          <Text style={{ color: "#D97706", fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" }}>
            ⏰ This task will be scheduled for 8:00 PM today by default.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={{
            backgroundColor: "#EC4899",
            borderRadius: 20,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", textTransform: "uppercase" }}>
            Log Chore
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

QuickChoreModal.displayName = "QuickChoreModal";
