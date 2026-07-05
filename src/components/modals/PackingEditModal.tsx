/*
 * FILE: src/components/modals/PackingEditModal.tsx
 * PURPOSE: Modal form to edit the shared packing list checklist inside Travel mode.
 *          Supports checking off items, adding new checklist points, and removing rows.
 * WHERE USED: Dashboard screen packing checklist widget manage button.
 */

// Import React module and hooks
import React, { useState } from "react";
// Import layout components, texts, inputs, button links, and lists scrolls
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
// Import theme hook
import { useTheme } from "../../context/ThemeContext";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";
// Import custom types schemas
import { PackingItem } from "../../types";

// Prop declarations mapping component params
interface PackingEditModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Array of current packing items
  packingList: PackingItem[];
  // Callback to insert new packing item document
  onAddItem: (name: string) => Promise<void>;
  // Callback to toggle completed status on packing items
  onToggleItem: (id: string, done: boolean) => Promise<void>;
  // Callback to delete packing item document
  onDeleteItem: (id: string) => Promise<void>;
}

// Render PackingEditModal memoized to optimize re-renders
export const PackingEditModal = React.memo(({
  visible,
  onClose,
  packingList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: PackingEditModalProps) => {
  // Access global dark theme context
  const { isDark } = useTheme();

  // Local state input managing item description name
  const [newItemName, setNewItemName] = useState("");
  // Loader status flag
  const [loading, setLoading] = useState(false);

  // Form submit callback executing parent updates
  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setLoading(true);
    try {
      await onAddItem(newItemName.trim());
      // Reset input field
      setNewItemName("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Color tokens
  const bg = isDark ? "#070913" : "#FFFFFF";
  const text = isDark ? "#F1F5F9" : "#1E1B4B";
  const muted = isDark ? "#A78BFA" : "#4F46E5";
  const bord = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.08)";
  const accent = "#6366F1";

  return (
    // Wrap packing checklist items inside sliding modal
    <SlideModal visible={visible} onClose={onClose} title="Shared Packing List">
      {/* Container wrapper limiting height offsets */}
      <View style={{ paddingBottom: 24, maxHeight: 500 }}>
        {/* Add Item form layout row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: "600",
              color: text,
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0,0,0,0.02)",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: bord,
            }}
            placeholder="Add item (e.g. Passport, Charger)"
            placeholderTextColor="#475569"
            value={newItemName}
            onChangeText={setNewItemName}
          />
          {/* Submit action button */}
          <TouchableOpacity
            onPress={handleAdd}
            disabled={loading || !newItemName.trim()}
            style={{
              backgroundColor: accent,
              paddingHorizontal: 16,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              opacity: !newItemName.trim() ? 0.6 : 1,
            }}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Scrollable list of packing items */}
        <ScrollView style={{ minHeight: 150 }} showsVerticalScrollIndicator={false}>
          {packingList.length === 0 ? (
            // Empty state placeholder
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialIcons name="card-travel" size={32} color={muted} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 13, color: isDark ? "#64748B" : "#94A3B8", fontWeight: "600" }}>
                No packing items added yet.
              </Text>
            </View>
          ) : (
            // Map packing list items row elements
            packingList.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: bord,
                  marginBottom: 8,
                }}
              >
                {/* Checkbox item toggle */}
                <TouchableOpacity
                  onPress={() => onToggleItem(item.id, !item.done)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
                >
                  <MaterialIcons
                    name={item.done ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={item.done ? "#10B981" : muted}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: item.done ? (isDark ? "#64748B" : "#94A3B8") : text,
                      textDecorationLine: item.done ? "line-through" : "none",
                    }}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>

                {/* Delete action button */}
                <TouchableOpacity
                  onPress={() => onDeleteItem(item.id)}
                  style={{
                    padding: 6,
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    borderRadius: 10,
                  }}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SlideModal>
  );
});

// Assign display name for DevTools tracing
PackingEditModal.displayName = "PackingEditModal";
