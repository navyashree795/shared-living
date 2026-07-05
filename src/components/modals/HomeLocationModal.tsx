/*
 * FILE: src/components/modals/HomeLocationModal.tsx
 * PURPOSE: Full-screen MapView modal enabling household owners to pin home coordinate coordinates,
 *          center on current GPS position, and drag pins.
 * WHERE USED: Dashboard screen household settings edit panels.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React, { useState, useEffect, useRef } from "react";
// Import UI layout components, touch triggers, modal containers, and loading indicators
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
// Import Map components and pinned markers
import MapView, { Marker } from "react-native-maps";
// Import device locations libraries
import * as Location from "expo-location";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";

// Prop declarations mapping component params
interface HomeLocationModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Existing pinned location coordinates dictionary
  initialLocation: { latitude: number; longitude: number } | null;
  // Submit function to write coordinates updates in Firestore
  onSave: (coords: { latitude: number; longitude: number }) => Promise<void>;
  // Active theme configuration value
  isDark: boolean;
}

/**
 * HomeLocationModal renders full-screen maps.
 */
export function HomeLocationModal({
  visible,
  onClose,
  initialLocation,
  onSave,
  isDark,
}: HomeLocationModalProps) {
  // Local state inputs managing selected coordinates
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation
  );
  // Loader status flag
  const [loading, setLoading] = useState(false);
  // Reference targeting the MapView component to trigger camera movements
  const mapRef = useRef<MapView | null>(null);

  // Sync state coordinates on visibilities updates or fetch device location coords if none exists
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

  // Effect: Trigger MapView pan animations whenever selected coordinates change
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

  // Center map camera on user current position coordinates
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

  // Submit pinned coordinate modifications
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
        {/* Header navigation bar */}
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
          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <MaterialIcons name="close" size={24} color={textMain} />
          </TouchableOpacity>
          {/* Title label */}
          <Text style={{ fontSize: 16, fontWeight: "900", color: textMain }}>
            Set Home Location
          </Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Map View */}
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
            {/* Draggable Marker Pin */}
            {selectedCoords && (
              <Marker
                coordinate={selectedCoords}
                draggable
                onDragEnd={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          {/* Floating Center On Me GPS Button */}
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

          {/* Bottom confirmation card */}
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

            {/* Confirm action button */}
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
