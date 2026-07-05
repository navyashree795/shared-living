/*
 * FILE: src/components/modals/QuickSettleModal.tsx
 * PURPOSE: Settle-up payment logger modal enabling users to record peer-to-peer repayments,
 *          select payees, enter amounts, and trigger alert updates.
 * WHERE USED: Dashboard screen quick shortcuts tray drawer.
 */

// Import React hooks for managing state parameters, input refs, and mount handlers
import React, { useState, useRef, useEffect } from "react";
// Import UI layout components, scroll boxes, input fields, buttons, and alerts
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
// Import Firestore commands to write document updates and handle server timestamps
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
// Import Firebase auth and database connections
import { auth, db } from "../../firebaseConfig";
// Import contexts managing user data, households, notifications, and active dark themes
import { useUser } from "../../context/UserContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
// Import helper utilities
import { logActivity } from "../../utils/activityUtils";
import { sendRemotePushNotification } from "../../utils/notificationUtils";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";

interface QuickSettleModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * QuickSettleModal logs payment transactions between roommates.
 */
export const QuickSettleModal = React.memo(({ visible, onClose }: QuickSettleModalProps) => {
  // Grab household details, members list, member name getter, and member profiles from context
  const { householdId, members, getMemberName, memberProfiles } = useHousehold();
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  // Local form inputs states
  const [settleAmount, setSettleAmount] = useState("");
  const [settleWithUid, setSettleWithUid] = useState<string | null>(null);

  // Input ref to trigger keyboard autofocus
  const amountInputRef = useRef<TextInput>(null);

  // Reset local states when modal mounts/opens
  useEffect(() => {
    if (visible) {
      setSettleAmount("");
      setSettleWithUid(null);
    }
  }, [visible]);

  // Action: Validates fields and logs payment documents
  const handleSave = async () => {
    const parsedAmount = parseFloat(settleAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (!settleWithUid) {
      Alert.alert("Error", "Please select a roommate to pay.");
      return;
    }
    if (!householdId) return;

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const currentUserName = userData?.username
      ? `@${userData.username}`
      : auth.currentUser?.email?.split("@")[0] || "Member";

    try {
      // Add document to expenses subcollection with type payment
      await addDoc(collection(db, "households", householdId, "expenses"), {
        type: "payment",
        amount: parsedAmount,
        fromPaidUid: currentUid,
        toReceivedUid: settleWithUid,
        createdAt: serverTimestamp(),
      });

      logActivity(
        householdId,
        "payment_add",
        `to ${getMemberName(settleWithUid)}`,
        currentUserName,
        parsedAmount
      );
      showToast("Payment recorded successfully", "success");

      // Send push alerts to the payment recipient
      try {
        const receiverToken = memberProfiles[settleWithUid]?.pushToken;
        if (receiverToken) {
          const senderName = getMemberName(currentUid);
          const nameToUse =
            senderName === "You"
              ? userData?.username
                ? `@${userData.username}`
                : "A roommate"
              : senderName;
          sendRemotePushNotification(
            [receiverToken],
            "🤝 Debt Settle Up",
            `${nameToUse} recorded a payment of ₹${parsedAmount} to you.`
          );
        }
      } catch (e) {
        console.error("Error sending push notification for settle up:", e);
      }

      onClose();
    } catch (err) {
      console.error("Error logging payment:", err);
      Alert.alert("Error", "Could not record payment.");
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#0F172A";
  const border = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const inputBg = isDark ? "#0F172A" : "#F8FAFC";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const primary = isDark ? "#818CF8" : "#4F46E5";

  // Filter out the current user to display only target payees
  const otherMembers = members.filter((uid) => uid !== auth.currentUser?.uid);

  return (
    <SlideModal visible={visible} onClose={onClose} title="Settle Up">
      <View style={{ gap: 20 }}>
        
        {/* Roommate selector section */}
        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>
            Pay Someone
          </Text>
          {otherMembers.length === 0 ? (
            <Text style={{ color: textMuted, fontSize: 13, textAlign: "center", marginVertical: 12 }}>
              No other members in this household.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -10, paddingHorizontal: 10 }}>
              {otherMembers.map((uid) => {
                const name = getMemberName(uid);
                const isSelected = settleWithUid === uid;
                return (
                  <TouchableOpacity
                    key={uid}
                    onPress={() => {
                      setSettleWithUid(uid);
                      // Move focus to amount input after short selection delay to pop keyboard
                      setTimeout(() => amountInputRef.current?.focus(), 150);
                    }}
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
                    {/* Avatar circle bubble */}
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
          )}
        </View>

        {/* Amount Repaid input section */}
        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            Amount Paid
          </Text>
          <View style={{ backgroundColor: inputBg, borderRadius: 20, paddingHorizontal: 18, height: 60, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: border }}>
            <Text style={{ color: primary, fontSize: 20, fontWeight: "900", marginRight: 10 }}>₹</Text>
            <TextInput
              ref={amountInputRef}
              style={{ flex: 1, color: textMain, fontSize: 22, fontWeight: "900" }}
              placeholder="0"
              placeholderTextColor={textMuted}
              keyboardType="numeric"
              value={settleAmount}
              onChangeText={setSettleAmount}
            />
          </View>
        </View>

        {/* Save button trigger */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={!settleWithUid}
          style={{
            backgroundColor: settleWithUid ? "#F59E0B" : isDark ? "#1E293B" : "#E2E8F0",
            borderRadius: 20,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Text
            style={{
              color: settleWithUid ? "#FFF" : textMuted,
              fontSize: 16,
              fontWeight: "900",
              textTransform: "uppercase",
            }}
          >
            Record Payment
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

QuickSettleModal.displayName = "QuickSettleModal";
