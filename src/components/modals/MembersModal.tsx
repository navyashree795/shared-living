/*
 * FILE: src/components/modals/MembersModal.tsx
 * PURPOSE: Roommate/member details display and administration modal. Prompts invitation share keys,
 *          lists geofenced status updates, and handles owner removal tools.
 * WHERE USED: Dashboard screen member icons click trigger.
 */

// Import React module reference
import React from "react";
// Import layout components, texts, button touch triggers, sharing API, and alert notifications
import { View, Text, TouchableOpacity, Share, Alert } from "react-native";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";
// Import clipboard copying library
import * as Clipboard from "expo-clipboard";
// Import slide modal template wrapper
import SlideModal from "../SlideModal";
// Import circular user avatar component
import { Avatar } from "../Avatar";
// Import utility function generating active invitation tokens
import { createInvitation } from "../../utils/invitationApi";

// Prop declarations mapping component params
interface MembersModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Active household parameters dictionary
  householdData: any;
  // Roommates details profiles dictionary
  memberProfiles: Record<string, any>;
  // Current user unique identifier key
  currentUserId: string;
  // Flag indicating if current user is the owner of the house/trip
  isOwner: boolean;
  // Callback kicking roommate from household documents subcollection
  handleRemoveMember: (uid: string) => void;
  // Call to launch toast popup alerts
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

// Render MembersModal memoized to optimize re-renders
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
  // Share link generator generating unique tokens
  const handleShareInvite = async () => {
    try {
      if (!householdData?.id) return;
      const token = await createInvitation(householdData.id);
      const inviteUrl = `https://shared-living-app.web.app/invite/${token}`;
      const message = `Join my household on House Sync!\n\nUse this link to join directly:\n${inviteUrl}\n\nOr enter the invite code: ${householdData.inviteCode}`;
      await Share.share({
        message,
        url: inviteUrl,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not generate invitation link.");
    }
  };

  return (
    // Wrap roommate lists inside global slide modal
    <SlideModal visible={visible} onClose={onClose} title="House Team">
      {/* Invite Code header box */}
      <View className="bg-indigo-600 rounded-[32px] p-6 mb-6 shadow-lg shadow-indigo-200">
        <Text className="text-white/70 text-[10px] font-bold uppercase tracking-[2px] mb-2">
          Invite Code
        </Text>
        <View className="flex-row justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
          {/* Main invite code value */}
          <Text className="text-white text-2xl font-black tracking-[4px]">
            {householdData?.inviteCode}
          </Text>
          {/* Copy-to-clipboard trigger button */}
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
        {/* Share link button */}
        <TouchableOpacity
          onPress={handleShareInvite}
          className="flex-row items-center justify-center bg-white/20 py-3 rounded-2xl border border-white/20 mt-4"
        >
          <MaterialIcons name="share" size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white font-bold">Share Invite Link</Text>
        </TouchableOpacity>
      </View>
      
      <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">
        Current Members
      </Text>
      
      {/* Members list mapping details and presence toggles */}
      <View className="gap-3 mb-6">
        {Object.entries(memberProfiles).map(([uid, member]: [string, any]) => (
          <View
            key={uid}
            className="flex-row items-center gap-4 bg-surfaceRaised p-4 rounded-3xl border border-border/50"
          >
            {/* Circular profile avatar wrapper */}
            <Avatar
              name={member.username || "Member"}
              size={48}
              bgColor="#FFFFFF"
              color="#4F46E5"
              photoUrl={member.photoUrl}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            />
            {/* Username and identity label info fields */}
            <View className="flex-1">
              <Text className="text-textMain font-black">
                {member.username || "Unknown Member"}
              </Text>
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {uid === currentUserId ? "You" : "Member"}
              </Text>
            </View>
            
            {/* geofenced At Home presence status dot indicator */}
            {(() => {
              const status = member.status || "home";
              const isHome = status === "home";
              return (
                <View className={`flex-row items-center gap-1 px-2.5 py-1 rounded-xl ${isHome ? "bg-emerald-500/10" : "bg-slate-500/10"}`}>
                  <Text style={{ fontSize: 10 }}>{isHome ? "🟢" : "🔴"}</Text>
                  <Text className="text-[9px] font-black uppercase tracking-wider text-textMain">
                    {isHome ? "At Home" : "Out"}
                  </Text>
                </View>
              );
            })()}

            {/* Kick member button (visible only to household owner) */}
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

// Assign display name for DevTools tracing
MembersModal.displayName = "MembersModal";
