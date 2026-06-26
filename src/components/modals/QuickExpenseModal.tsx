import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { useUser } from "../../context/UserContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { logActivity } from "../../utils/activityUtils";
import { sendRemotePushNotification } from "../../utils/notificationUtils";
import { detectCategory } from "../../utils/expenseUtils";
import SlideModal from "../SlideModal";

interface QuickExpenseModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QuickExpenseModal = React.memo(({ visible, onClose }: QuickExpenseModalProps) => {
  const { householdId, members, getMemberName, memberProfiles } = useHousehold();
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setAmount("");
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 250);
    }
  }, [visible]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    const expenseTitle = title.trim();

    if (!expenseTitle) {
      Alert.alert("Error", "Please enter a description.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (!householdId) return;

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const currentUserName = userData?.username
      ? `@${userData.username}`
      : auth.currentUser?.email?.split("@")[0] || "Member";

    try {
      await addDoc(collection(db, "households", householdId, "expenses"), {
        type: "expense",
        title: expenseTitle,
        amount: parsedAmount,
        category: detectCategory(expenseTitle),
        paidByUid: currentUid,
        payerName: getMemberName(currentUid),
        splitAmong: members, // Split among everyone by default for Quick Expense
        createdAt: serverTimestamp(),
      });

      logActivity(householdId, "expense_add", expenseTitle, currentUserName, parsedAmount);
      showToast("Expense logged successfully", "success");

      // Push notification
      try {
        const otherMembers = members.filter((uid) => uid !== currentUid);
        const tokens = otherMembers
          .map((uid) => memberProfiles[uid]?.pushToken)
          .filter(Boolean) as string[];

        if (tokens.length > 0) {
          const payerName = getMemberName(currentUid);
          const nameToUse =
            payerName === "You"
              ? userData?.username
                ? `@${userData.username}`
                : "A roommate"
              : payerName;
          sendRemotePushNotification(
            tokens,
            "💸 New Expense Logged",
            `${nameToUse} quick-logged an expense: "${expenseTitle}" for ₹${parsedAmount}.`
          );
        }
      } catch (e) {
        console.error("Error sending push notification for quick expense:", e);
      }

      onClose();
    } catch (err) {
      console.error("Error adding quick expense:", err);
      Alert.alert("Error", "Could not add expense.");
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#0F172A";
  const border = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const inputBg = isDark ? "#0F172A" : "#F8FAFC";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const primary = isDark ? "#818CF8" : "#4F46E5";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Log Quick Expense">
      <View style={{ gap: 20 }}>
        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            Description
          </Text>
          <TextInput
            ref={titleInputRef}
            style={{ backgroundColor: inputBg, borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: border }}
            placeholder="e.g. Electric bill, Snacks"
            placeholderTextColor={textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            Amount
          </Text>
          <View style={{ backgroundColor: inputBg, borderRadius: 20, paddingHorizontal: 18, height: 60, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: border }}>
            <Text style={{ color: primary, fontSize: 20, fontWeight: "900", marginRight: 10 }}>₹</Text>
            <TextInput
              style={{ flex: 1, color: textMain, fontSize: 22, fontWeight: "900" }}
              placeholder="0"
              placeholderTextColor={textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View style={{ backgroundColor: isDark ? "rgba(99,102,241,0.08)" : "#EEF2FF", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }}>
          <Text style={{ color: primary, fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" }}>
            💡 This bill will automatically be split equally among all {members.length} roommates in the household.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={{
            backgroundColor: "#6366F1",
            borderRadius: 20,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", textTransform: "uppercase" }}>
            Log Expense
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

QuickExpenseModal.displayName = "QuickExpenseModal";
