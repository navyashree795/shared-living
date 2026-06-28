import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { getKeyboardAvoidingProps } from "../../utils/keyboardUtils";
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
  const { behavior, keyboardVerticalOffset } = getKeyboardAvoidingProps('modal');
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
  const bgSurface = isDark ? "#0F172A" : "#FFFFFF";

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: bgSurface,
            borderRadius: 32,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.25,
            shadowRadius: 35,
            elevation: 10,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? "rgba(236, 72, 153, 0.2)" : "#FDF2F8", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="cleaning-services" size={20} color="#EC4899" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "900", color: textMain }}>Log Chore</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9", borderRadius: 20 }}>
              <MaterialIcons name="close" size={20} color={textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 24 }}>
            {/* Input Section */}
            <View>
              <Text style={{ color: textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 }}>
                What needs to be done?
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: inputBg, borderRadius: 20, borderWidth: 1, borderColor: border, paddingHorizontal: 16 }}>
                <MaterialIcons name="edit" size={18} color={textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  ref={inputRef}
                  style={{ flex: 1, paddingVertical: 16, color: textMain, fontSize: 16, fontWeight: "700" }}
                  placeholder="e.g. Wash dishes..."
                  placeholderTextColor={textMuted}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
            </View>

            {/* Assignee Section */}
            <View>
              <Text style={{ color: textMuted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 }}>
                Assign To
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
                        opacity: isSelected ? 1 : 0.6,
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: isSelected ? primary : (isDark ? "#1E293B" : "#F1F5F9"),
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 8,
                          shadowColor: isSelected ? primary : "transparent",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          borderWidth: 2,
                          borderColor: isSelected ? primary : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 20, fontWeight: "900", color: isSelected ? "#FFF" : textMain }}>
                          {name.replace("@", "")[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: isSelected ? "900" : "700", color: isSelected ? primary : textMain }}>
                        {uid === auth.currentUser?.uid ? "You" : name.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Info Pill */}
            <View style={{ backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#FFFBEB", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7" }}>
              <MaterialIcons name="schedule" size={18} color="#D97706" />
              <Text style={{ color: "#D97706", fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 18 }}>
                Schedules for 8:00 PM today.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSave}
              style={{
                backgroundColor: "#EC4899",
                borderRadius: 20,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#EC4899",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialIcons name="check-circle" size={20} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
                Log Chore
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

QuickChoreModal.displayName = "QuickChoreModal";
