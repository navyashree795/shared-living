import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import SlideModal from "../SlideModal";

interface TripDetailsEditModalProps {
  visible: boolean;
  onClose: () => void;
  tripDetails: any;
  onSave: (updates: any) => Promise<void>;
}

export const TripDetailsEditModal = React.memo(({
  visible,
  onClose,
  tripDetails,
  onSave,
}: TripDetailsEditModalProps) => {
  const { isDark } = useTheme();
  
  const [destination, setDestination] = useState(tripDetails?.destination || "");
  const [startDate, setStartDate] = useState(tripDetails?.startDate || "");
  const [endDate, setEndDate] = useState(tripDetails?.endDate || "");
  const [hotelName, setHotelName] = useState(tripDetails?.hotelName || "");
  const [hotelAddress, setHotelAddress] = useState(tripDetails?.hotelAddress || "");
  const [hotelPhone, setHotelPhone] = useState(tripDetails?.hotelPhone || "");
  const [bookingRef, setBookingRef] = useState(tripDetails?.bookingRef || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setDestination(tripDetails?.destination || "");
      setStartDate(tripDetails?.startDate || "");
      setEndDate(tripDetails?.endDate || "");
      setHotelName(tripDetails?.hotelName || "");
      setHotelAddress(tripDetails?.hotelAddress || "");
      setHotelPhone(tripDetails?.hotelPhone || "");
      setBookingRef(tripDetails?.bookingRef || "");
    }
  }, [visible, tripDetails]);

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
      });
      onClose();
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

  const renderInput = (label: string, value: string, onChangeText: (v: string) => void, placeholder: string) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingLeft: 4 }}>
        {label}
      </Text>
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
    <SlideModal visible={visible} onClose={onClose} title="Edit Trip Details">
      <View style={{ paddingBottom: 24 }}>
        {renderInput("Destination", destination, setDestination, "e.g. Paris, France")}
        
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            {renderInput("Start Date", startDate, setStartDate, "e.g. YYYY-MM-DD")}
          </View>
          <View style={{ flex: 1 }}>
            {renderInput("End Date", endDate, setEndDate, "e.g. YYYY-MM-DD")}
          </View>
        </View>

        {renderInput("Hotel Name", hotelName, setHotelName, "e.g. Grand Plaza Hotel")}
        {renderInput("Hotel Address", hotelAddress, setHotelAddress, "e.g. 123 Rue de Rivoli")}
        {renderInput("Hotel Phone", hotelPhone, setHotelPhone, "e.g. +33 1 23 45 67 89")}
        {renderInput("Booking Reference", bookingRef, setBookingRef, "e.g. AB1234XYZ")}

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

TripDetailsEditModal.displayName = "TripDetailsEditModal";
