import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import SlideModal from '../components/SlideModal';
import * as Clipboard from 'expo-clipboard';
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';

const NAV_ITEMS = [
  {
    name: 'Grocery',
    icon: 'shopping-cart',
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Shared shopping list',
  },
  {
    name: 'Expenses',
    icon: 'receipt-long',
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Split bills & balances',
  },
  {
    name: 'Chores',
    icon: 'cleaning-services',
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Assign household tasks',
  },
];

export default function DashboardScreen({ navigation, route }) {
  const { householdId, householdData: initialData } = route.params || {};
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [userData, setUserData] = useState(null);
  const [householdData, setHouseholdData] = useState(initialData || null);
  const { memberProfiles } = useHouseholdMembers(householdData?.members);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) setUserData(snap.data());
        } catch {}
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!householdId) return;
    const unsub = onSnapshot(doc(db, 'households', householdId), (snap) => {
      if (snap.exists()) setHouseholdData({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [householdId]);

  const members = householdData?.members || [];
  const isOwner = householdData?.createdBy === auth.currentUser?.uid;

  const handleRemoveMember = async (memberUid) => {
    const profile = memberProfiles[memberUid];
    const name = profile?.username ? `@${profile.username}` : (profile?.email || 'this member');
    
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${name} from the household?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'households', householdId), {
                members: arrayRemove(memberUid)
              });
            } catch (e) {
              Alert.alert("Error", "Could not remove member: " + e.message);
            }
          }
        }
      ]
    );
  };

  const handleNav = (screenName) => {
    navigation.navigate(screenName, { householdId, members });
  };

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      {/* Side Menu */}
      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity className="flex-1 bg-black/60" activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <View className="w-[78%] h-full bg-white px-6 border-r border-border shadow-2xl">
            <SafeAreaView className="flex-1">
              <View className="mt-10 mb-6">
                <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mb-4 shadow-md">
                  <Text className="text-white text-2xl font-extrabold">
                    {(userData?.username || auth.currentUser?.email)?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-textMain text-lg font-bold mb-0.5">
                  {userData?.username ? `@${userData.username}` : 'User'}
                </Text>
                <Text className="text-textMuted text-sm mb-1">
                  {auth.currentUser?.email}
                </Text>
              </View>

              <View className="h-[1px] bg-border my-5" />

              <TouchableOpacity
                className="flex-row items-center py-3 gap-3"
                onPress={() => { setIsMenuVisible(false); navigation.replace('HouseholdSelection'); }}
              >
                <View className="w-10 h-10 rounded-xl bg-secondary items-center justify-center">
                   <MaterialIcons name="swap-horiz" size={22} color="#4F46E5" />
                </View>
                <Text className="text-primary text-base font-bold">Switch Household</Text>
              </TouchableOpacity>

              <View className="h-[1px] bg-border my-5" />

              <Text className="text-textMuted text-xs font-bold tracking-widest mb-3">HOUSEHOLD</Text>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="home" size={24} color="#111827" />
                <Text className="text-textMain text-base font-medium">{householdData?.name}</Text>
              </View>

              <TouchableOpacity
                className="flex-row items-center py-4 gap-3 mt-auto mb-6"
                onPress={() => { setIsMenuVisible(false); auth.signOut(); }}
              >
                <MaterialIcons name="logout" size={24} color="#EF4444" />
                <Text className="text-danger text-base font-bold">Sign Out</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header */}
      <View className="flex-row items-center mt-2 mb-6">
        <TouchableOpacity onPress={() => setIsMenuVisible(true)} className="mr-4 p-1">
          <MaterialIcons name="menu" size={28} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-textMuted text-sm font-medium">Good day 👋</Text>
          <Text className="text-textMain text-3xl font-extrabold mt-1">
            {householdData?.name || 'My Household'}
          </Text>
        </View>
      </View>

      {/* Members Chip */}
      <TouchableOpacity 
        onPress={() => setIsMembersModalVisible(true)}
        className="flex-row items-center gap-2 bg-white rounded-full px-4 py-1.5 self-start mb-10 border border-border shadow-sm"
      >
        <MaterialIcons name="people" size={14} color="#6B7280" />
        <Text className="text-textMain text-[11px] font-bold">
          {members.length} Member{members.length !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>

      {/* Feature Cards */}
      <View className="flex-1 gap-6 items-center">
        {NAV_ITEMS.map(item => (
          <TouchableOpacity
            key={item.name}
            className="w-[90%] rounded-[32px] p-6 border justify-start shadow-sm bg-white border-gray-100"
            onPress={() => handleNav(item.name)}
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4 bg-gray-50">
              <MaterialIcons name={item.icon} size={28} color={item.color} />
            </View>
            <Text className="text-xl font-bold text-textMain mb-1">{item.name}</Text>
            <Text className="text-sm font-medium text-textMuted">{item.subtitle}</Text>
            <View className="flex-row items-center mt-3">
               <Text className="text-xs font-bold text-textMuted tracking-widest mr-1 uppercase">Open</Text>
               <MaterialIcons name="arrow-forward" size={14} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Members Modal */}
      <SlideModal
        visible={isMembersModalVisible}
        onClose={() => setIsMembersModalVisible(false)}
        title="Household Team"
      >
        <View className="mb-8">
          <View className="bg-secondary/40 rounded-[28px] p-6 border border-primary/5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1">Invite Code</Text>
                <Text className="text-2xl font-black text-primary tracking-widest uppercase">{householdData?.inviteCode}</Text>
              </View>
              <TouchableOpacity 
                onPress={async () => {
                  if (householdData?.inviteCode) {
                    await Clipboard.setStringAsync(householdData.inviteCode);
                    Alert.alert("Copied", "Invite code copied to clipboard!");
                  }
                }}
                className="bg-primary px-5 py-3 rounded-xl shadow-sm"
              >
                <Text className="text-white font-bold text-xs uppercase tracking-wider">Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="mb-10">
          <Text className="text-textMuted text-[10px] font-bold tracking-widest uppercase mb-4">Members</Text>
          {members.map(uid => {
            const profile = memberProfiles[uid];
            const isMe = uid === auth.currentUser?.uid;
            const displayName = profile?.username ? `@${profile.username}` : (profile?.email?.split('@')[0] || 'Member');
            
            return (
              <View key={uid} className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isMe ? 'bg-primary/10' : 'bg-secondary'}`}>
                  <MaterialIcons name="person" size={20} color={isMe ? "#4F46E5" : "#6B7280"} />
                </View>
                <View className="flex-1">
                  <Text className="text-textMain text-sm font-bold">
                    {isMe ? 'You' : displayName}
                    {uid === householdData?.createdBy && <Text className="text-primary text-[10px] font-black tracking-widest ml-1 uppercase"> (Owner)</Text>}
                  </Text>
                  <Text className="text-textMuted text-xs">{profile?.email}</Text>
                </View>
                {isOwner && uid !== auth.currentUser?.uid && (
                  <TouchableOpacity onPress={() => handleRemoveMember(uid)} className="p-2">
                    <MaterialIcons name="person-remove" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
