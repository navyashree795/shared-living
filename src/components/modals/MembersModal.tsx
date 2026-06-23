import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import SlideModal from "../SlideModal";
import { Avatar } from "../Avatar";

interface MembersModalProps {
  visible: boolean;
  onClose: () => void;
  householdData: any;
  memberProfiles: Record<string, any>;
  currentUserId: string;
  isOwner: boolean;
  handleRemoveMember: (uid: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const MembersModal = React.memo(({
  visible,
  onClose,
  householdData,
  memberProfiles,
  currentUserId,
  isOwner,
  handleRemoveMember,
  showToast,
}: MembersModalProps) => {
  return (
    <SlideModal visible={visible} onClose={onClose} title="House Team">
      <View className="bg-indigo-600 rounded-[32px] p-6 mb-6 shadow-lg shadow-indigo-200">
        <Text className="text-white/70 text-[10px] font-bold uppercase tracking-[2px] mb-2">
          Invite Code
        </Text>
        <View className="flex-row justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
          <Text className="text-white text-2xl font-black tracking-[4px]">
            {householdData?.inviteCode}
          </Text>
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(householdData?.inviteCode || "");
              showToast("Code copied", "success");
            }}
            className="bg-white/20 p-2 rounded-xl"
          >
            <MaterialIcons name="content-copy" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">
        Current Members
      </Text>
      
      <View className="gap-3 mb-6">
        {Object.entries(memberProfiles).map(([uid, member]: [string, any]) => (
          <View
            key={uid}
            className="flex-row items-center gap-4 bg-surfaceRaised p-4 rounded-3xl border border-border/50"
          >
            <Avatar
              name={member.username || "Member"}
              size={48}
              bgColor="#FFFFFF"
              color="#4F46E5"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            />
            <View className="flex-1">
              <Text className="text-textMain font-black">
                {member.username || "Unknown Member"}
              </Text>
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {uid === currentUserId ? "You" : "Member"}
              </Text>
            </View>
            {isOwner && uid !== currentUserId && (
              <TouchableOpacity
                onPress={() => handleRemoveMember(uid)}
                className="p-2"
              >
                <MaterialIcons name="person-remove" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </SlideModal>
  );
});

MembersModal.displayName = "MembersModal";
