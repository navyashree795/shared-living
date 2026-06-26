import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import SlideModal from "../SlideModal";

interface HouseholdSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  householdsList: { id: string; name: string }[];
  currentHouseholdId: string;
  setHouseholdId: (id: string) => void;
  onNavigateToSelection: () => void;
  isDark: boolean;
}

export const HouseholdSwitcherModal = React.memo(({
  visible,
  onClose,
  householdsList,
  currentHouseholdId,
  setHouseholdId,
  onNavigateToSelection,
  isDark,
}: HouseholdSwitcherModalProps) => {
  const bord = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.08)";
  const text = isDark ? "#F1F5F9" : "#0F172A";
  const muted = isDark ? "#A78BFA" : "#4F46E5";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Switch Household">
      <View style={{ gap: 12, paddingBottom: 24 }}>
        {householdsList.map((h) => (
          <TouchableOpacity
            key={h.id}
            onPress={() => {
              setHouseholdId(h.id);
              onClose();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: h.id === currentHouseholdId ? "#6366F1" : bord,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor:
                  h.id === currentHouseholdId
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
                color={h.id === currentHouseholdId ? "#FFFFFF" : muted}
              />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: "700",
                color:
                  h.id === currentHouseholdId
                    ? isDark
                      ? "#F1F5F9"
                      : "#0F172A"
                    : text,
              }}
            >
              {h.name}
            </Text>
            {h.id === currentHouseholdId && (
              <MaterialIcons name="check-circle" size={24} color="#6366F1" />
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            onClose();
            onNavigateToSelection();
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
          <MaterialIcons name="add" size={20} color={muted} style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: muted }}>
            Create or Join Another
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

HouseholdSwitcherModal.displayName = "HouseholdSwitcherModal";
