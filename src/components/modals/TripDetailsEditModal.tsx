/*
 * FILE: src/components/modals/TripDetailsEditModal.tsx
 * PURPOSE: Trip detail parameters configuration modal inside Travel mode. Prompts edits for hotel bookings,
 *          destinations, and dates.
 * WHERE USED: Dashboard screen trip details edit trigger.
 */

// Import React module and hooks
import React, { useState, useEffect } from "react";
// Import layout components, texts, inputs, and button components
import { View, Text, TextInput, TouchableOpacity } from "react-native";
// Import theme hook
import { useTheme } from "../../context/ThemeContext";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";

// Prop declarations mapping component params
interface TripDetailsEditModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Existing trip configuration parameters dictionary
  tripDetails: any;
  // Submit function to write details updates in Firestore
  onSave: (updates: any) => Promise<void>;
}

// Render TripDetailsEditModal memoized to optimize re-renders
export const TripDetailsEditModal = React.memo(({
  visible,
  onClose,
  tripDetails,
  onSave,
}: TripDetailsEditModalProps) => {
  // Access global dark theme context
  const { isDark } = useTheme();
  
  // Local state inputs managing destination
  const [destination, setDestination] = useState(tripDetails?.destination || "");
  // Local state inputs managing start date string
  const [startDate, setStartDate] = useState(tripDetails?.startDate || "");
  // Local state inputs managing end date string
  const [endDate, setEndDate] = useState(tripDetails?.endDate || "");
  // Local state inputs managing hotel name
  const [hotelName, setHotelName] = useState(tripDetails?.hotelName || "");
  // Local state inputs managing hotel address details
  const [hotelAddress, setHotelAddress] = useState(tripDetails?.hotelAddress || "");
  // Local state inputs managing contact phone lines
  const [hotelPhone, setHotelPhone] = useState(tripDetails?.hotelPhone || "");
  // Local state inputs managing hotel reservation codes
  const [bookingRef, setBookingRef] = useState(tripDetails?.bookingRef || "");
  // Local state inputs managing custom mileage/km metrics
  const [distanceTraveled, setDistanceTraveled] = useState(tripDetails?.distanceTraveled || "");
  // Loader status flag
  const [loading, setLoading] = useState(false);

  // Sync inputs values whenever visibility updates
  useEffect(() => {
    if (visible) {
      setDestination(tripDetails?.destination || "");
      setStartDate(tripDetails?.startDate || "");
      setEndDate(tripDetails?.endDate || "");
      setHotelName(tripDetails?.hotelName || "");
      setHotelAddress(tripDetails?.hotelAddress || "");
      setHotelPhone(tripDetails?.hotelPhone || "");
      setBookingRef(tripDetails?.bookingRef || "");
      setDistanceTraveled(tripDetails?.distanceTraveled || "");
    }
  }, [visible, tripDetails]);

  // Form submit callback executing parent updates
  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave({
        destination: destination.trim(),
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        hotelName: hotelName.trim(),
        hotelAddress: hotelAddress.trim(),
        hotelPhone: hotelPhone.trim(),
        bookingRef: bookingRef.trim(),
        distanceTraveled: distanceTraveled.trim(),
      });
      // Close sheet after updates finish
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
  const renderInput = (label: string, value: string, onChangeText: (v: string) => void, placeholder: string) => (
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
        }}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );

  return (
    // Wrap form elements inside sliding modal
    <SlideModal visible={visible} onClose={onClose} title="Edit Trip Details">
      <View style={{ paddingBottom: 24 }}>
        {/* Destination input */}
        {renderInput("Destination", destination, setDestination, "e.g. Paris, France")}
        
        {/* Date boxes row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            {renderInput("Start Date", startDate, setStartDate, "e.g. YYYY-MM-DD")}
          </View>
          <View style={{ flex: 1 }}>
            {renderInput("End Date", endDate, setEndDate, "e.g. YYYY-MM-DD")}
          </View>
        </View>

        {/* Accommodation and details */}
        {renderInput("Hotel Name", hotelName, setHotelName, "e.g. Grand Plaza Hotel")}
        {renderInput("Hotel Address", hotelAddress, setHotelAddress, "e.g. 123 Rue de Rivoli")}
        {renderInput("Hotel Phone", hotelPhone, setHotelPhone, "e.g. +33 1 23 45 67 89")}
        {renderInput("Booking Reference", bookingRef, setBookingRef, "e.g. AB1234XYZ")}
        {renderInput("Distance Traveled (km)", distanceTraveled, setDistanceTraveled, "e.g. 1250")}

        {/* Submit action button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={{
            backgroundColor: accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "800" }}>
            {loading ? "Saving..." : "Save Details"}
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

// Assign display name for DevTools tracing
TripDetailsEditModal.displayName = "TripDetailsEditModal";
