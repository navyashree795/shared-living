/*
 * FILE: src/components/modals/ItineraryEditModal.tsx
 * PURPOSE: Modal form to add or propose events on the itinerary timeline in Travel mode.
 *          Differentiates layout alerts depending on whether the user is the trip creator.
 * WHERE USED: Dashboard screen itinerary widget click trigger.
 */

// Import React module and hooks
import React, { useState } from "react";
// Import layout components, texts, inputs, and button structures
import { View, Text, TextInput, TouchableOpacity } from "react-native";
// Import theme hook
import { useTheme } from "../../context/ThemeContext";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";
// Import Firebase auth links
import { auth } from "../../firebaseConfig";

// Prop declarations mapping component params
interface ItineraryEditModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Flag indicating if current roommate is the trip owner
  isCreator: boolean;
  // Submit function to write details to itinerary timeline subcollection
  onAdd: (item: { date: string; time: string; activity: string; notes?: string; approved: boolean }) => Promise<void>;
}

// Render ItineraryEditModal memoized to optimize re-renders
export const ItineraryEditModal = React.memo(({
  visible,
  onClose,
  isCreator,
  onAdd,
}: ItineraryEditModalProps) => {
  // Access global dark theme context
  const { isDark } = useTheme();

  // Local state inputs managing activity date
  const [date, setDate] = useState("");
  // Local state inputs managing activity time
  const [time, setTime] = useState("");
  // Local state inputs managing activity description
  const [activity, setActivity] = useState("");
  // Local state inputs managing activity notes
  const [notes, setNotes] = useState("");
  // Loader status flag
  const [loading, setLoading] = useState(false);

  // Form submit callback executing parent updates
  const handleSubmit = async () => {
    // Validate required fields
    if (!activity.trim() || !date.trim() || !time.trim()) {
      return;
    }
    setLoading(true);
    try {
      await onAdd({
        date: date.trim(),
        time: time.trim(),
        activity: activity.trim(),
        notes: notes.trim(),
        approved: isCreator, // Auto-approved if user is the trip creator; otherwise flags as proposed
      });
      // Reset local inputs fields
      setDate("");
      setTime("");
      setActivity("");
      setNotes("");
      onClose();
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

  // Reusable input form wrapper element
  const renderInput = (label: string, value: string, onChangeText: (v: string) => void, placeholder: string, multiline = false) => (
    <View style={{ marginBottom: 12 }}>
      {/* Title label element */}
      <Text style={{ fontSize: 10, fontWeight: "800", color: muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingLeft: 4 }}>
        {label}
      </Text>
      {/* Input text box */}
      <TextInput
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: text,
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0,0,0,0.02)",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: bord,
          textAlignVertical: multiline ? "top" : "center",
          minHeight: multiline ? 80 : undefined,
        }}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );

  return (
    // Wrap form elements inside sliding modal
    <SlideModal visible={visible} onClose={onClose} title={isCreator ? "Add Itinerary Activity" : "Propose Trip Activity"}>
      <View style={{ paddingBottom: 24 }}>
        {/* Warning notification banner if user is not the trip creator */}
        {!isCreator && (
          <View style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.15)" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#F59E0B", lineHeight: 18 }}>
              💡 Since you are not the trip creator, this activity will be proposed for approval. It will show up on the timeline once approved by the creator.
            </Text>
          </View>
        )}

        {/* Activity input */}
        {renderInput("Activity Name", activity, setActivity, "e.g. Louvre Museum Visit")}
        
        {/* Date and Time boxes row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            {renderInput("Date", date, setDate, "e.g. YYYY-MM-DD")}
          </View>
          <View style={{ flex: 1 }}>
            {renderInput("Time", time, setTime, "e.g. 10:00 AM")}
          </View>
        </View>

        {/* Notes multiline input */}
        {renderInput("Notes", notes, setNotes, "e.g. Booking reference: #2312, dress code: formal", true)}

        {/* Submit action button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !activity.trim() || !date.trim() || !time.trim()}
          style={{
            backgroundColor: accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            marginTop: 12,
            opacity: (!activity.trim() || !date.trim() || !time.trim()) ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "800" }}>
            {loading ? "Submitting..." : isCreator ? "Add Event" : "Propose Event"}
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

// Assign display name for DevTools tracing
ItineraryEditModal.displayName = "ItineraryEditModal";
