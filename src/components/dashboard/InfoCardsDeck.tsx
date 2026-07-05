/*
 * FILE: src/components/dashboard/InfoCardsDeck.tsx
 * PURPOSE: Horizontally scrolling slider component of household credentials and utility cards.
 *          Provides quick copying, viewing toggles, and direct links.
 * WHERE USED: Dashboard screen household metadata cards deck.
 */

// Import React module reference
import React from "react";
// Import layout components, scrolls, and touch triggers
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";
// Import clipboard copying library
import * as Clipboard from "expo-clipboard";

interface InfoCardsDeckProps {
  detailsList: any[];
  isDark: boolean;
  revealedFields: string[];
  toggleFieldVisibility: (id: string) => void;
  handlePhoneCall: (phone: string) => void;
  handleOpenLink: (link: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

// Render InfoCardsDeck memoized to optimize re-renders
export const InfoCardsDeck = React.memo(({
  detailsList,
  isDark,
  revealedFields,
  toggleFieldVisibility,
  handlePhoneCall,
  handleOpenLink,
  showToast,
}: InfoCardsDeckProps) => {
  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";

  // ─── COMPONENT THEME COLOR ASSIGNER ───────────────────────────────────────
  // Dynamically assigns color palettes based on field type and keywords match (Wifi, Landlord, Trash, etc.)
  const getFieldTheme = (field: any) => {
    const icon = field.icon || "";
    const label = (field.label || "").toLowerCase();
    
    // Wifi parameters styling
    if (label.includes("wifi") || icon === "wifi" || icon === "vpn-key") {
      return {
        primary: "#6366F1", // Indigo
        bg: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF",
      };
    }
    // Landlord parameters styling
    if (label.includes("landlord") || label.includes("contact") || label.includes("phone") || icon === "phone-in-talk" || icon === "call") {
      return {
        primary: "#10B981", // Emerald
        bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
      };
    }
    // Trash parameters styling
    if (label.includes("trash") || label.includes("truck") || label.includes("garbage") || icon === "delete-outline" || icon === "delete") {
      return {
        primary: "#F59E0B", // Amber
        bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
      };
    }
    // Link parameters styling
    if (field.type === "link" || icon === "link") {
      return {
        primary: "#EC4899", // Pink
        bg: isDark ? "rgba(236, 72, 153, 0.15)" : "#FDF2F8",
      };
    }
    // Default styling fallback
    return {
      primary: "#8B5CF6", // Violet
      bg: isDark ? "rgba(139, 92, 246, 0.15)" : "#F5F3FF",
    };
  };

  // Copy parameter string to clipboard
  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast("Copied to clipboard", "success");
  };

  return (
    // Wrap cards in styled outer view
    <View style={{ marginBottom: 28 }}>
      {/* Horizontally scrolling list wrapper */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 8 }}
      >
        {detailsList.map((field: any) => {
          // Resolve theme layout colors based on labels keywords matching
          const theme = getFieldTheme(field);
          return (
            <View
              key={field.id}
              style={{
                width: 160,
                backgroundColor: isDark ? "rgba(30, 41, 59, 0.45)" : "#FFFFFF",
                borderRadius: 24,
                padding: 14,
                borderWidth: 1.5,
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : theme.primary + "15",
                minHeight: 125,
                justifyContent: "space-between",
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.25 : 0.06,
                shadowRadius: 10,
                elevation: isDark ? 0 : 3,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative background glow circles */}
              <View
                style={{
                  position: "absolute",
                  bottom: -24,
                  right: -24,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.primary + (isDark ? "14" : "0A"),
                  pointerEvents: "none",
                }}
              />

              {/* Card Header Section with Icon and Actions */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                {/* Utility icon bubble */}
                <View
                  style={{
                    backgroundColor: theme.bg,
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcons name={field.icon} size={18} color={theme.primary} />
                </View>

                {/* Password visibility toggles & copy/call buttons */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {field.type === "password" && (
                    <TouchableOpacity
                      onPress={() => toggleFieldVisibility(field.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#E2E8F0",
                      }}
                    >
                      <MaterialIcons
                        name={revealedFields.includes(field.id) ? "visibility" : "visibility-off"}
                        size={14}
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {/* Actions (Launch Web Links / Trigger calls / Copy strings) */}
                  <TouchableOpacity
                    onPress={() => {
                      if (field.type === "link") {
                        handleOpenLink(field.value);
                      } else if (field.type === "phone") {
                        handlePhoneCall(field.value);
                      } else {
                        copyToClipboard(field.value);
                      }
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#E2E8F0",
                    }}
                  >
                    <MaterialIcons
                      name={
                        field.type === "link"
                          ? "open-in-new"
                          : field.type === "phone"
                          ? "call"
                          : "content-copy"
                      }
                      size={14}
                      color={theme.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card Footer Section showing label and decrypted value */}
              <View style={{ marginTop: 14 }}>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: isDark ? "#94A3B8" : "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  {field.label}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "900",
                    color: textMain,
                  }}
                  numberOfLines={1}
                >
                  {/* Hide password characters unless explicitly clicked */}
                  {field.type === "password" && !revealedFields.includes(field.id)
                    ? "••••••••"
                    : field.value}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

// Explicitly assign display name for React DevTools mapping
InfoCardsDeck.displayName = "InfoCardsDeck";
