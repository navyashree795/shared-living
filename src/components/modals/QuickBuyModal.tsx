/*
 * FILE: src/components/modals/QuickBuyModal.tsx
 * PURPOSE: Simplified modal enabling roommates to quickly append items to the shared shopping list
 *          directly from the Dashboard, featuring input autofocus and push notifications.
 * WHERE USED: Dashboard screen quick shortcuts tray drawer.
 */

// Import React hooks for managing state parameters and text input focus refs
import React, { useState, useRef, useEffect } from "react";
// Import layout layouts, texts, inputs, touch links, and alerts
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
// Import Firestore commands to insert new documents to subcollections
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
// Import Firebase auth and database connections
import { auth, db } from "../../firebaseConfig";
// Import user profiles, households lists, toast popups, and themes contexts
import { useUser } from "../../context/UserContext";
import { useHousehold } from "../../context/HouseholdContext";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
// Import helper utilities
import { logActivity } from "../../utils/activityUtils";
import { sendRemotePushNotification } from "../../utils/notificationUtils";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";

interface QuickBuyModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * QuickBuyModal renders form fields to add groceries items.
 */
export const QuickBuyModal = React.memo(({ visible, onClose }: QuickBuyModalProps) => {
  // Grab household details, members list, and member profiles from context
  const { householdId, members, memberProfiles } = useHousehold();
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  // Local form inputs states
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  // Input ref to trigger keyboard autofocus
  const inputRef = useRef<TextInput>(null);

  // Effect: Reset form fields and autofocus item name input when modal mounts/opens
  useEffect(() => {
    if (visible) {
      setName("");
      setQty("");
      setPrice("");
      // 250ms timeout ensures animations have completed before popping keyboard
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [visible]);

  // Action: Validates inputs and inserts a new grocery document
  const handleSave = async () => {
    const itemName = name.trim();
    if (!itemName) {
      Alert.alert("Error", "Please enter an item name.");
      return;
    }
    if (!householdId) return;

    const priceNum = parseFloat(price) || 0;
    const currentUserName = userData?.username
      ? `@${userData.username}`
      : auth.currentUser?.email?.split("@")[0] || "Member";

    try {
      // Add document to groceries subcollection
      await addDoc(collection(db, "households", householdId, "groceries"), {
        name: itemName,
        done: false,
        category: "staples", // Default category assigned is Staples for Quick Buy
        qty: qty.trim(),
        price: priceNum,
        addedBy: currentUserName,
        expenseLogged: false,
        createdAt: serverTimestamp(),
      });

      logActivity(householdId, "grocery_add", itemName, currentUserName);
      showToast("Item added to Groceries", "success");

      // Send push alerts to other household members
      try {
        const currentUid = auth.currentUser?.uid;
        if (currentUid) {
          const otherMembers = members.filter((uid) => uid !== currentUid);
          const tokens = otherMembers
            .map((uid) => memberProfiles[uid]?.pushToken)
            .filter(Boolean) as string[];

          if (tokens.length > 0) {
            const nameToUse = userData?.username ? `@${userData.username}` : "A roommate";
            sendRemotePushNotification(
              tokens,
              "🛒 Grocery List Update",
              `${nameToUse} quick-added "${itemName}" to the shopping list.`
            );
          }
        }
      } catch (e) {
        console.error("Error sending push notification for quick buy:", e);
      }

      onClose();
    } catch (err) {
      console.error("Error adding grocery item:", err);
      Alert.alert("Error", "Could not add item.");
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#0F172A";
  const border = isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const inputBg = isDark ? "#0F172A" : "#F8FAFC";
  const textMuted = isDark ? "#94A3B8" : "#64748B";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Quick Buy Grocery">
      <View style={{ gap: 20 }}>
        {/* Item Name input */}
        <View>
          <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
            Item Name
          </Text>
          <TextInput
            ref={inputRef}
            style={{ backgroundColor: inputBg, borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: border }}
            placeholder="e.g. Eggs, Coffee"
            placeholderTextColor={textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Quantity & Price input fields */}
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
              Quantity (Optional)
            </Text>
            <TextInput
              style={{ backgroundColor: inputBg, borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: border }}
              placeholder="e.g. 1 dozen"
              placeholderTextColor={textMuted}
              value={qty}
              onChangeText={setQty}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textMuted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
              Price (Optional)
            </Text>
            <TextInput
              style={{ backgroundColor: inputBg, borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: border }}
              placeholder="₹ Amount"
              placeholderTextColor={textMuted}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </View>
        </View>

        {/* Save button trigger */}
        <TouchableOpacity
          onPress={handleSave}
          style={{
            backgroundColor: "#10B981",
            borderRadius: 20,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", textTransform: "uppercase" }}>
            Add to List
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

QuickBuyModal.displayName = "QuickBuyModal";
