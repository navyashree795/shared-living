import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import { useUser } from "../../context/UserContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { logActivity } from "../../utils/activityUtils";
import { sendRemotePushNotification } from "../../utils/notificationUtils";
import SlideModal from "../SlideModal";

interface QuickSettleModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QuickSettleModal = React.memo(({ visible, onClose }: QuickSettleModalProps) => {
  const { householdId, members, getMemberName, memberProfiles } = useHousehold();
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  const [settleAmount, setSettleAmount] = useState("");
  const [settleWithUid, setSettleWithUid] = useState<string | null>(null);

  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setSettleAmount("");
      setSettleWithUid(null);
    }
  }, [visible]);

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

      // Remote push notification to receiver
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

  const otherMembers = members.filter((uid) => uid !== auth.currentUser?.uid);

  return (
    <SlideModal visible={visible} onClose={onClose} title="Settle Up">
      <View style={{ gap: 20 }}>
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
