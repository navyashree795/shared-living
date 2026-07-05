/*
 * FILE: src/components/modals/ProfileModal.tsx
 * PURPOSE: Interactive profile settings slide modal. Provides a simple form 
 *          to edit display names.
 * WHERE USED: ProfileScreen settings triggers.
 */

// Import React module reference
import React from "react";
// Import layout components, texts, inputs, and button templates
import { View, Text, TextInput, TouchableOpacity } from "react-native";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";

// Define prop types matching component context bindings
interface ProfileModalProps {
  // Flag controlling overlay visibility
  visible: boolean;
  // Trigger callback when clicking backdrop/close buttons
  onClose: () => void;
  // Local state username string value
  editUsername: string;
  // State updater function modifying username changes
  setEditUsername: (val: string) => void;
  // Form submit callback triggering profile saves in Firestore
  handleUpdateProfile: () => void;
}

// Render ProfileModal memoized to optimize re-renders
export const ProfileModal = React.memo(({
  visible,
  onClose,
  editUsername,
  setEditUsername,
  handleUpdateProfile,
}: ProfileModalProps) => {
  return (
    // Wrap contents in global slide-up modal component
    <SlideModal visible={visible} onClose={onClose} title="My Profile">
      {/* Set vertical gap margins between children */}
      <View className="gap-6">
        {/* Profile fields wrapper */}
        <View>
          {/* Label text styled matching design color tokens */}
          <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
            Display Name
          </Text>
          {/* Username Input Field */}
          <TextInput
            className="bg-surfaceRaised rounded-[28px] p-5 text-textMain font-black border border-border/50"
            placeholder="Your Name"
            value={editUsername}
            onChangeText={setEditUsername}
          />
        </View>
        
        {/* Save/Submit button wrapper */}
        <TouchableOpacity
          onPress={handleUpdateProfile}
          className="bg-indigo-600 rounded-[28px] py-5 items-center shadow-lg shadow-indigo-200"
        >
          {/* Text label styles */}
          <Text className="text-white font-black text-base uppercase tracking-widest">
            Update Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

// Explicitly assign display name for React DevTools mapping
ProfileModal.displayName = "ProfileModal";
