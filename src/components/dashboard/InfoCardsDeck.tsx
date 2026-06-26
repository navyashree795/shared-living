import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
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

  const getFieldTheme = (field: any) => {
    const icon = field.icon || "";
    const label = (field.label || "").toLowerCase();
    
    if (label.includes("wifi") || icon === "wifi" || icon === "vpn-key") {
      return {
        primary: "#6366F1", // Indigo
        bg: isDark ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF",
      };
    }
    if (label.includes("landlord") || label.includes("contact") || label.includes("phone") || icon === "phone-in-talk" || icon === "call") {
      return {
        primary: "#10B981", // Emerald
        bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
      };
    }
    if (label.includes("trash") || label.includes("truck") || label.includes("garbage") || icon === "delete-outline" || icon === "delete") {
      return {
        primary: "#F59E0B", // Amber
        bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
      };
    }
    if (field.type === "link" || icon === "link") {
      return {
        primary: "#EC4899", // Pink
        bg: isDark ? "rgba(236, 72, 153, 0.15)" : "#FDF2F8",
      };
    }
    return {
      primary: "#8B5CF6", // Violet
      bg: isDark ? "rgba(139, 92, 246, 0.15)" : "#F5F3FF",
    };
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast("Copied to clipboard", "success");
  };

  return (
    <View style={{ marginBottom: 28 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 8 }}
      >
        {detailsList.map((field: any) => {
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
                elevation: 3,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Ambient background glow circle */}
              <View
                style={{
                  position: "absolute",
                  bottom: -24,
                  right: -24,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.primary,
                  opacity: isDark ? 0.08 : 0.04,
                  pointerEvents: "none",
                }}
              />

              {/* Card Top Row */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                {/* Icon Container */}
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

                {/* Actions Row */}
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

              {/* Card Bottom / Info Section */}
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

InfoCardsDeck.displayName = "InfoCardsDeck";
