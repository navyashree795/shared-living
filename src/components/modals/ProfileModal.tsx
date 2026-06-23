import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import SlideModal from "../SlideModal";

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  editUsername: string;
  setEditUsername: (val: string) => void;
  handleUpdateProfile: () => void;
}

export const ProfileModal = React.memo(({
  visible,
  onClose,
  editUsername,
  setEditUsername,
  handleUpdateProfile,
}: ProfileModalProps) => {
  return (
    <SlideModal visible={visible} onClose={onClose} title="My Profile">
      <View className="gap-6">
        <View>
          <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">
            Display Name
          </Text>
          <TextInput
            className="bg-surfaceRaised rounded-[28px] p-5 text-textMain font-black border border-border/50"
            placeholder="Your Name"
            value={editUsername}
            onChangeText={setEditUsername}
          />
        </View>
        <TouchableOpacity
          onPress={handleUpdateProfile}
          className="bg-indigo-600 rounded-[28px] py-5 items-center shadow-lg shadow-indigo-200"
        >
          <Text className="text-white font-black text-base uppercase tracking-widest">
            Update Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SlideModal>
  );
});

ProfileModal.displayName = "ProfileModal";
