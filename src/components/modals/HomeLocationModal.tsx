import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";

interface HomeLocationModalProps {
  visible: boolean;
  onClose: () => void;
  initialLocation: { latitude: number; longitude: number } | null;
  onSave: (coords: { latitude: number; longitude: number }) => Promise<void>;
  isDark: boolean;
}

export function HomeLocationModal({
  visible,
  onClose,
  initialLocation,
  onSave,
  isDark,
}: HomeLocationModalProps) {
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation
  );
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  // Load initial location or fetch current device location on mount
  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        setSelectedCoords(initialLocation);
      } else {
        // Fetch current coordinates to center map
        (async () => {
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === "granted") {
              const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
              });
              setSelectedCoords({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
            }
          } catch (e) {
            console.warn("Failed to get location inside Map Modal:", e);
          }
        })();
      }
    }
  }, [visible, initialLocation]);

  // Animate map when selected coordinates change
  useEffect(() => {
    if (selectedCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedCoords.latitude,
          longitude: selectedCoords.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        1000
      );
    }
  }, [selectedCoords]);

  const handleCenterOnMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setSelectedCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) {
      console.warn("Error centering location:", e);
    }
  };

  const handleConfirm = async () => {
    if (!selectedCoords) return;
    setLoading(true);
    try {
      await onSave(selectedCoords);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const textMain = isDark ? "#F1F5F9" : "#1E1B4B";
  const bgSurface = isDark ? "#0E1324" : "#FFFFFF";

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: bgSurface }}>
        {/* Map Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 50,
            paddingBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2FF",
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={24} color={textMain} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "900", color: textMain }}>
            Set Home Location
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Full Screen Map */}
        <View style={{ flex: 1, position: "relative" }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: selectedCoords?.latitude || 37.78825,
              longitude: selectedCoords?.longitude || -122.4324,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
            onPress={(e) => {
              setSelectedCoords(e.nativeEvent.coordinate);
            }}
          >
            {selectedCoords && (
              <Marker
                coordinate={selectedCoords}
                draggable
                onDragEnd={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          {/* Floating Center On Me Button */}
          <TouchableOpacity
            onPress={handleCenterOnMe}
            style={{
              position: "absolute",
              right: 20,
              bottom: 120,
              backgroundColor: isDark ? "#1E1B4B" : "#FFFFFF",
              borderRadius: 30,
              width: 54,
              height: 54,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "#EEF2FF",
            }}
          >
            <MaterialIcons name="my-location" size={24} color="#4F46E5" />
          </TouchableOpacity>

          {/* Bottom Card for Confirmation */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: bgSurface,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 10,
              borderTopWidth: 1,
              borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#EEF2FF",
            }}
          >
            <Text style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B", fontWeight: "700", marginBottom: 6 }}>
              📌 Pinned Coordinates
            </Text>
            {selectedCoords ? (
              <Text style={{ fontSize: 14, fontWeight: "800", color: textMain, marginBottom: 20 }}>
                Lat: {selectedCoords.latitude.toFixed(6)}, Lng: {selectedCoords.longitude.toFixed(6)}
              </Text>
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#EF4444", marginBottom: 20 }}>
                Please select a point on the map
              </Text>
            )}

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading || !selectedCoords}
              style={{
                backgroundColor: "#4F46E5",
                borderRadius: 16,
                paddingVertical: 15,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 15 }}>
                    PIN HOME LOCATION
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
