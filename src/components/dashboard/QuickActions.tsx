import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface QuickActionsProps {
  onQuickBuy: () => void;
  onSettleUp: () => void;
  onQuickExpense: () => void;
  onQuickChore: () => void;
  isDark: boolean;
  isTravel?: boolean;
}

export function QuickActions({
  onQuickBuy,
  onSettleUp,
  onQuickExpense,
  onQuickChore,
  isDark,
  isTravel = false,
}: QuickActionsProps) {
  const textMain = isDark ? "#F1F5F9" : "#1E1B4B";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const glassBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.08)";
  const glassBg = isDark ? "rgba(255, 255, 255, 0.04)" : "#FFFFFF";

  const actions = [
    {
      id: "quick-buy",
      title: "Quick Buy",
      subtitle: "Grocery",
      icon: "shopping-cart" as const,
      color: "#10B981",
      gradient: isDark ? (["rgba(16, 185, 129, 0.12)", "rgba(16, 185, 129, 0.02)"] as const) : (["#E6FDF5", "#FFFFFF"] as const),
      onPress: onQuickBuy,
    },
    {
      id: "settle-up",
      title: "Settle Up",
      subtitle: "Balances",
      icon: "handshake" as const,
      color: "#F59E0B",
      gradient: isDark ? (["rgba(245, 158, 11, 0.12)", "rgba(245, 158, 11, 0.02)"] as const) : (["#FEF8E7", "#FFFFFF"] as const),
      onPress: onSettleUp,
    },
    {
      id: "quick-expense",
      title: "Quick Bill",
      subtitle: "Split Equal",
      icon: "account-balance-wallet" as const,
      color: "#6366F1",
      gradient: isDark ? (["rgba(99, 102, 241, 0.12)", "rgba(99, 102, 241, 0.02)"] as const) : (["#EEF2FF", "#FFFFFF"] as const),
      onPress: onQuickExpense,
    },
    {
      id: "quick-chore",
      title: "Log Chore",
      subtitle: "Due Today",
      icon: "cleaning-services" as const,
      color: "#EC4899",
      gradient: isDark ? (["rgba(236, 72, 153, 0.12)", "rgba(236, 72, 153, 0.02)"] as const) : (["#FDF2F8", "#FFFFFF"] as const),
      onPress: onQuickChore,
    },
  ];

  const filteredActions = actions.filter((act) => {
    if (isTravel && (act.id === "quick-buy" || act.id === "quick-chore")) {
      return false;
    }
    return true;
  });

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Text
          style={{
            color: isDark ? "#A78BFA" : "#4F46E5",
            fontSize: 11,
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: 1.5,
          }}
        >
          🚀 Quick Shortcuts
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {filteredActions.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={item.onPress}
            activeOpacity={0.8}
            style={{
              width: 110,
              height: 115,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: glassBorder,
              backgroundColor: glassBg,
              overflow: "hidden",
              shadowColor: item.color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.05 : 0.03,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <LinearGradient
              colors={item.gradient}
              style={{ flex: 1, padding: 14, justifyContent: "space-between" }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: item.color + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name={item.icon} size={18} color={item.color} />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "900",
                    color: textMain,
                    lineHeight: 16,
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    color: textMuted,
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {item.subtitle}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
