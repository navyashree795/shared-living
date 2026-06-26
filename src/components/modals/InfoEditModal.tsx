import React, { useState, memo } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Linking } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import SlideModal from "../SlideModal";
import { TimeWheelPicker } from "../TimeWheelPicker";
import { getSyncedDate } from "../../utils/timeUtils";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";

interface InfoEditModalProps {
  visible: boolean;
  onClose: () => void;
  isEditMode: boolean;
  householdData: any;
  handleUpdateInfo: (updates: any) => void;
  infoModalTab: "all" | "landlord" | "wifi" | "trash";
}

export const HouseholdInfoModalContent = memo(({
  tab,
  isEdit,
  data,
  householdName,
  onSave,
}: any) => {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(householdName || "");
  const [fields, setFields] = useState<any[]>(() => {
    if (data?.details && data.details.length > 0) return data.details;
    const initial = [];
    if (data?.wifiName)
      initial.push({
        id: "wifi_net",
        label: "WiFi Network",
        value: data.wifiName,
        type: "text",
        icon: "wifi",
      });
    if (data?.wifiPass)
      initial.push({
        id: "wifi_pass",
        label: "WiFi Password",
        value: data.wifiPass,
        type: "password",
        icon: "vpn-key",
      });
    if (data?.landlordName)
      initial.push({
        id: "landlord_contact",
        label: "Landlord",
        value: data.landlordName,
        type: "text",
        icon: "phone-in-talk",
      });
    if (data?.trashArrivalTime)
      initial.push({
        id: "trash_truck",
        label: "Trash Truck",
        value: data.trashArrivalTime,
        type: "time",
        icon: "delete-outline",
      });
    return initial;
  });

  const [activeTimePickerId, setActiveTimePickerId] = useState<string | null>(null);
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  const toggleFieldVisibility = (id: string) => {
    setRevealedFields((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    const updates: any = { details: fields };

    const wifiF = fields.find(
      (f) =>
        f.id === "wifi_net" ||
        f.label.toLowerCase().includes("network") ||
        f.label.toLowerCase().includes("wifi name")
    );
    const passF = fields.find(
      (f) =>
        f.id === "wifi_pass" ||
        f.label.toLowerCase().includes("password") ||
        f.label.toLowerCase().includes("wifi pass")
    );
    const landF = fields.find(
      (f) =>
        f.id === "landlord_contact" ||
        f.label.toLowerCase().includes("landlord")
    );
    const trashF = fields.find(
      (f) => f.type === "time" && f.icon === "delete-outline"
    );

    updates.wifiName = wifiF ? wifiF.value : "";
    updates.wifiPass = passF ? passF.value : "";
    updates.landlordName = landF ? landF.value : "";
    updates.trashArrivalTime = trashF ? trashF.value : "";

    onSave({ name: name.trim() || "My Household", info: updates });
  };

  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        label: "",
        value: "",
        type: "text",
        icon: "description",
      },
    ]);
  };

  const handleDeleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: any) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast("Copied to clipboard", "success");
  };

  const handlePhoneCall = async (phone: string) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s+/g, "")}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Clipboard.setStringAsync(phone);
        showToast("Phone copied to clipboard", "success");
      }
    } catch {
      await Clipboard.setStringAsync(phone);
      showToast("Phone copied to clipboard", "success");
    }
  };

  const handleOpenLink = async (link: string) => {
    if (!link) return;
    let formatted = link.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    try {
      const supported = await Linking.canOpenURL(formatted);
      if (supported) {
        await Linking.openURL(formatted);
      } else {
        await Clipboard.setStringAsync(link);
        showToast("Link copied to clipboard", "success");
      }
    } catch {
      await Clipboard.setStringAsync(link);
      showToast("Link copied to clipboard", "success");
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#1E1B4B";

  if (isEdit) {
    return (
      <>
        <View style={{ marginBottom: 16 }}>
          <View style={{ gap: 16, paddingBottom: 24 }}>
            {/* Household Name */}
            <View
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                padding: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: isDark ? "#A78BFA" : "#4F46E5",
                  textTransform: "uppercase",
                  marginBottom: 6,
                  letterSpacing: 0.5,
                }}
              >
                Household Name
              </Text>
              <TextInput
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: isDark ? "#F1F5F9" : "#1E1B4B",
                  backgroundColor: isDark ? "#070913" : "#FFFFFF",
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                }}
                placeholder="e.g. My Flat"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Dynamic Fields List */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color: isDark ? "#94A3B8" : "#64748B",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginTop: 8,
                marginLeft: 4,
              }}
            >
              Custom Fields
            </Text>

            {fields.map((field) => (
              <View
                key={field.id}
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  padding: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  gap: 10,
                }}
              >
                {/* Inputs Row */}
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: "800",
                      color: isDark ? "#F1F5F9" : "#1E1B4B",
                      backgroundColor: isDark ? "#070913" : "#FFFFFF",
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    }}
                    placeholder="Label (e.g. WiFi Network)"
                    value={field.label}
                    onChangeText={(v) => handleUpdateField(field.id, { label: v })}
                  />
                  {field.type === "time" ? (
                    <TouchableOpacity
                      onPress={() => setActiveTimePickerId(field.id)}
                      style={{
                        flex: 1.2,
                        height: 42,
                        backgroundColor: isDark ? "#070913" : "#FFFFFF",
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: field.value
                            ? isDark
                              ? "#FBBF24"
                              : "#D97706"
                            : "#94A3B8",
                        }}
                      >
                        {field.value || "Set Time"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TextInput
                      style={{
                        flex: 1.2,
                        fontSize: 13,
                        fontWeight: "700",
                        color: isDark ? "#FBBF24" : "#1E1B4B",
                        backgroundColor: isDark ? "#070913" : "#FFFFFF",
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                      }}
                      placeholder="Value"
                      value={field.value}
                      onChangeText={(v) => handleUpdateField(field.id, { value: v })}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteField(field.id)}
                    style={{
                      padding: 8,
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      borderRadius: 10,
                    }}
                  >
                    <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Type Selection pills */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { type: "text", label: "Text", icon: "description" },
                    { type: "password", label: "Password", icon: "vpn-key" },
                    { type: "time", label: "Time", icon: "delete-outline" },
                    { type: "phone", label: "Phone", icon: "call" },
                    { type: "link", label: "Link", icon: "link" },
                  ].map((t) => (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => {
                        handleUpdateField(field.id, {
                          type: t.type,
                          icon: t.icon,
                        });
                        if (t.type === "time") setActiveTimePickerId(field.id);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        backgroundColor:
                          field.type === t.type
                            ? isDark
                              ? "rgba(192, 132, 252, 0.22)"
                              : "rgba(99, 102, 241, 0.12)"
                            : "transparent",
                        borderWidth: 1,
                        borderColor:
                          field.type === t.type
                            ? isDark
                              ? "#C084FC"
                              : "#4F46E5"
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color:
                            field.type === t.type
                              ? isDark
                                ? "#C084FC"
                                : "#4F46E5"
                              : isDark
                              ? "#94A3B8"
                              : "#64748B",
                        }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Nested TimePicker Modal */}
                {activeTimePickerId === field.id && (
                  <Modal visible={activeTimePickerId === field.id} transparent animationType="fade">
                    <TouchableOpacity
                      className="flex-1 bg-black/40 justify-center items-center px-6"
                      activeOpacity={1}
                      onPress={() => setActiveTimePickerId(null)}
                    >
                      <TouchableOpacity
                        activeOpacity={1}
                        className="w-full bg-surface rounded-[32px] p-6 shadow-2xl"
                        onPress={(e) => e.stopPropagation()}
                      >
                        <TimeWheelPicker
                          initialTime={(() => {
                            if (!field.value || typeof field.value !== "string" || !field.value.includes(":"))
                              return getSyncedDate();
                            const parts = field.value.split(":").map(Number);
                            const h = parts[0];
                            const m = parts[1];
                            if (isNaN(h) || isNaN(m)) return getSyncedDate();
                            const d = getSyncedDate();
                            d.setHours(h, m, 0, 0);
                            return d;
                          })()}
                          onConfirm={(date) => {
                            const hours = date.getHours().toString().padStart(2, "0");
                            const minutes = date.getMinutes().toString().padStart(2, "0");
                            handleUpdateField(field.id, {
                              value: `${hours}:${minutes}`,
                            });
                            setActiveTimePickerId(null);
                          }}
                          onCancel={() => setActiveTimePickerId(null)}
                        />
                        <TouchableOpacity
                          onPress={() => setActiveTimePickerId(null)}
                          className="mt-4 py-3 items-center"
                        >
                          <Text className="text-textMuted font-bold text-sm">Cancel</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Modal>
                )}
              </View>
            ))}

            {/* Add Field Button */}
            <TouchableOpacity
              onPress={handleAddField}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                padding: 14,
                backgroundColor: isDark ? "rgba(192, 132, 252, 0.12)" : "rgba(99, 102, 241, 0.06)",
                borderRadius: 16,
                borderStyle: "dashed",
                borderWidth: 1,
                borderColor: isDark ? "#C084FC" : "#4F46E5",
                marginTop: 6,
              }}
            >
              <MaterialIcons
                name="add"
                size={18}
                color={isDark ? "#C084FC" : "#4F46E5"}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: isDark ? "#C084FC" : "#4F46E5",
                }}
              >
                Add Custom Field
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          className="bg-indigo-600 rounded-2xl py-4 items-center shadow-lg shadow-indigo-300 mb-8"
        >
          <Text className="text-white font-black text-lg">Save Changes</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <>
      <View style={{ marginBottom: 16 }}>
        <View style={{ gap: 12, paddingBottom: 24 }}>
          {fields.length > 0 ? (
            fields.map((field) => (
              <View
                key={field.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  padding: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(99, 102, 241, 0.08)",
                      padding: 8,
                      borderRadius: 12,
                    }}
                  >
                    <MaterialIcons
                      name={field.icon || "description"}
                      size={18}
                      color={isDark ? "#C084FC" : "#4F46E5"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 9,
                        color: isDark ? "#94A3B8" : "#64748B",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {field.label}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: textMain,
                      }}
                    >
                      {field.type === "password" && field.value
                        ? revealedFields.includes(field.id)
                          ? field.value
                          : "••••••••"
                        : field.value || "Not Set"}
                    </Text>
                  </View>
                </View>

                {/* Actions Based on Type */}
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {field.type === "password" && field.value ? (
                    <>
                      <TouchableOpacity
                        onPress={() => toggleFieldVisibility(field.id)}
                        style={{
                          padding: 7,
                          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                          borderRadius: 10,
                        }}
                      >
                        <MaterialIcons
                          name={revealedFields.includes(field.id) ? "visibility" : "visibility-off"}
                          size={14}
                          color={isDark ? "#A78BFA" : "#4F46E5"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(field.value)}
                        style={{
                          padding: 7,
                          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                          borderRadius: 10,
                        }}
                      >
                        <MaterialIcons name="content-copy" size={14} color={isDark ? "#A78BFA" : "#4F46E5"} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {field.type === "phone" && field.value ? (
                    <TouchableOpacity
                      onPress={() => handlePhoneCall(field.value)}
                      style={{
                        padding: 7,
                        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                        borderRadius: 10,
                      }}
                    >
                      <MaterialIcons name="call" size={14} color={isDark ? "#A78BFA" : "#4F46E5"} />
                    </TouchableOpacity>
                  ) : null}
                  {field.type === "link" && field.value ? (
                    <TouchableOpacity
                      onPress={() => handleOpenLink(field.value)}
                      style={{
                        padding: 7,
                        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                        borderRadius: 10,
                      }}
                    >
                      <MaterialIcons name="link" size={14} color={isDark ? "#A78BFA" : "#4F46E5"} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: isDark ? "#94A3B8" : "#64748B",
                }}
              >
                No custom fields added yet. Tap Edit to begin!
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
});

HouseholdInfoModalContent.displayName = "HouseholdInfoModalContent";

export const InfoEditModal = React.memo(({
  visible,
  onClose,
  isEditMode,
  householdData,
  handleUpdateInfo,
  infoModalTab,
}: InfoEditModalProps) => {
  return (
    <SlideModal
      visible={visible}
      onClose={onClose}
      title={isEditMode ? "Edit Household" : "Household Info"}
      scrollEnabled={true}
    >
      <HouseholdInfoModalContent
        tab={infoModalTab}
        isEdit={isEditMode}
        data={householdData?.info}
        householdName={householdData?.name}
        onSave={handleUpdateInfo}
      />
    </SlideModal>
  );
});

InfoEditModal.displayName = "InfoEditModal";
