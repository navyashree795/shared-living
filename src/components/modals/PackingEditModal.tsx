import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import SlideModal from "../SlideModal";
import { MaterialIcons } from "@expo/vector-icons";
import { PackingItem } from "../../types";

interface PackingEditModalProps {
  visible: boolean;
  onClose: () => void;
  packingList: PackingItem[];
  onAddItem: (name: string) => Promise<void>;
  onToggleItem: (id: string, done: boolean) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const PackingEditModal = React.memo(({
  visible,
  onClose,
  packingList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: PackingEditModalProps) => {
  const { isDark } = useTheme();

  const [newItemName, setNewItemName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setLoading(true);
    try {
      await onAddItem(newItemName.trim());
      setNewItemName("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? "#070913" : "#FFFFFF";
  const text = isDark ? "#F1F5F9" : "#1E1B4B";
  const muted = isDark ? "#A78BFA" : "#4F46E5";
  const bord = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(99, 102, 241, 0.08)";
  const accent = "#6366F1";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Shared Packing List">
      <View style={{ paddingBottom: 24, maxHeight: 500 }}>
        {/* Add Item form */}
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

        {/* Packing items list */}
        <ScrollView style={{ minHeight: 150 }} showsVerticalScrollIndicator={false}>
          {packingList.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialIcons name="card-travel" size={32} color={muted} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 13, color: isDark ? "#64748B" : "#94A3B8", fontWeight: "600" }}>
                No packing items added yet.
              </Text>
            </View>
          ) : (
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

PackingEditModal.displayName = "PackingEditModal";
