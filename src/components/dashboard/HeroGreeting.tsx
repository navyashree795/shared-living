import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { auth } from "../../firebaseConfig";

interface HeroGreetingProps {
  greeting: string;
  username: string;
  agendaItemsLength: number;
  isDark: boolean;
  netBalance: number;
  nextChore: any | null;
  onMarkChoreDone: (chore: any) => Promise<void>;
  onNudgeRoommate: (chore: any) => void;
  getMemberName: (uid: string) => string;
  isTravel?: boolean;
}

export const HeroGreeting = React.memo(({
  greeting,
  username,
  agendaItemsLength,
  isDark,
  netBalance,
  nextChore,
  onMarkChoreDone,
  onNudgeRoommate,
  getMemberName,
  isTravel = false,
}: HeroGreetingProps) => {
  const currentUid = auth.currentUser?.uid;
  
  // Dynamic styling based on net balance
  let cardColors: readonly [string, string, ...string[]];
  let glassBorder: string;
  let shadowColor: string;
  let balanceText: string;
  let balanceIcon: keyof typeof MaterialIcons.glyphMap;
  let balanceColor: string;
  let statusMsg: string;

  if (netBalance > 0.01) {
    // Roommates owe user money (Net Positive) - Green/Emerald theme
    cardColors = isDark
      ? (["#064E3B", "#022C22"] as const)
      : (["#D1FAE5", "#F0FDF4"] as const);
    glassBorder = isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)";
    shadowColor = "#10B981";
    balanceText = `Owed ₹${Math.round(netBalance)}`;
    balanceIcon = "trending-up";
    balanceColor = "#10B981";
    statusMsg = `Roommates owe you a total of ₹${Math.round(netBalance)}.`;
  } else if (netBalance < -0.01) {
    // User owes roommates money (Net Negative) - Rose/Red theme
    cardColors = isDark
      ? (["#4C0519", "#310411"] as const)
      : (["#FFE4E6", "#FFF1F2"] as const);
    glassBorder = isDark ? "rgba(244, 63, 94, 0.2)" : "rgba(244, 63, 94, 0.15)";
    shadowColor = "#F43F5E";
    balanceText = `Owe ₹${Math.round(Math.abs(netBalance))}`;
    balanceIcon = "trending-down";
    balanceColor = "#F43F5E";
    statusMsg = `You owe roommates a total of ₹${Math.round(Math.abs(netBalance))}.`;
  } else {
    // Settled up (Neutral) - Indigo/Theme color
    cardColors = isDark
      ? (["#1E1B4B", "#0F1320"] as const)
      : (["#E8EAFF", "#FFFFFF"] as const);
    glassBorder = isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)";
    shadowColor = "#4F46E5";
    balanceText = "Settled Up";
    balanceIcon = "check-circle";
    balanceColor = "#6366F1";
    statusMsg =
      agendaItemsLength === 0
        ? "✨ All clean and clear! No urgent chores or debts left today."
        : `⚠️ You have ${agendaItemsLength} action item${agendaItemsLength > 1 ? "s" : ""} today.`;
  }

  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";
  const textMuted = isDark ? "#94A3B8" : "#64748B";

  const isMyChore = nextChore && nextChore.assignedToUid === currentUid;

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 20 }}>
      <LinearGradient
        colors={cardColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 32,
          padding: 24,
          borderWidth: 1,
          borderColor: glassBorder,
          shadowColor: shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.3 : 0.04,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        {/* Top Header Row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "900", color: isDark ? "#A78BFA" : "#4F46E5", textTransform: "uppercase", letterSpacing: 1.5 }}>
              {greeting}
            </Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: textMain, marginTop: 4, letterSpacing: -0.5 }}>
              {username}
            </Text>
          </View>
          
          {/* Net Balance Status Chip */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#FFFFFF",
              borderColor: glassBorder,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 16,
              gap: 6,
            }}
          >
            <MaterialIcons name={balanceIcon} size={16} color={balanceColor} />
            <Text style={{ fontSize: 12, fontWeight: "900", color: textMain }}>
              {balanceText}
            </Text>
          </View>
        </View>
        
        {/* Separator */}
        <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2FF", marginVertical: 16 }} />
        
        {/* Balance Status Message */}
        <Text style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#4F46E5", fontWeight: "700", marginBottom: nextChore && !isTravel ? 16 : 0 }}>
          {statusMsg}
        </Text>

        {/* Actionable Chore Card */}
        {nextChore && !isTravel && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(99, 102, 241, 0.04)",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: glassBorder,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "900",
                  color: isMyChore ? "#EC4899" : "#F59E0B",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 2,
                }}
              >
                {isMyChore ? "🧹 Your Next Chore" : `🧹 Next: ${getMemberName(nextChore.assignedToUid)}`}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: textMain }} numberOfLines={1}>
                {nextChore.title}
              </Text>
              <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                Due at {nextChore.time}
              </Text>
            </View>

            {isMyChore ? (
              <TouchableOpacity
                onPress={() => onMarkChoreDone(nextChore)}
                style={{
                  backgroundColor: "#10B981",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  gap: 4,
                }}
              >
                <MaterialIcons name="check" size={14} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
                  Done
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onNudgeRoommate(nextChore)}
                style={{
                  backgroundColor: "#F59E0B",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  gap: 4,
                }}
              >
                <MaterialIcons name="notifications" size={14} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
                  Nudge
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
});

HeroGreeting.displayName = "HeroGreeting";
