/*
 * FILE: src/components/modals/HouseholdSwitcherModal.tsx
 * PURPOSE: Modal enabling users to switch between multiple household contexts (different homes or trips)
 *          or navigate to setup screens to join new ones.
 * WHERE USED: Dashboard screen household switcher dropdown trigger.
 */

// Import React module reference
import React from "react";
// Import layout components, texts, and button touch components
import { View, Text, TouchableOpacity } from "react-native";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";

// Prop declarations mapping component params
interface HouseholdSwitcherModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // List of households user has joined
  householdsList: { id: string; name: string }[];
  // ID of the currently selected household context
  currentHouseholdId: string;
  // Function callback updating selected household context value
  setHouseholdId: (id: string) => void;
  // Navigation redirect callback
  onNavigateToSelection: () => void;
  // Active theme configuration value
  isDark: boolean;
}

// Render HouseholdSwitcherModal memoized to optimize re-renders
export const HouseholdSwitcherModal = React.memo(({
  visible,
  onClose,
  householdsList,
  currentHouseholdId,
  setHouseholdId,
  onNavigateToSelection,
  isDark,
}: HouseholdSwitcherModalProps) => {
  // Theme color styling variables mapping
  const bord = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.08)";
  const text = isDark ? "#F1F5F9" : "#0F172A";
  const muted = isDark ? "#A78BFA" : "#4F46E5";

  return (
    // Wrap switcher buttons list inside global slide modal
    <SlideModal visible={visible} onClose={onClose} title="Switch Household">
      <View style={{ gap: 12, paddingBottom: 24 }}>
        {/* Render a button for each household option the user has joined */}
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
            {/* Home Icon Container */}
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
            
            {/* Household name text */}
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
            {/* Checkmark icon if selected */}
            {h.id === currentHouseholdId && (
              <MaterialIcons name="check-circle" size={24} color="#6366F1" />
            )}
          </TouchableOpacity>
        ))}

        {/* Create/Join another household action trigger */}
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

// Assign display name for DevTools tracing
HouseholdSwitcherModal.displayName = "HouseholdSwitcherModal";
