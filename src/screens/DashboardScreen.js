import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, Share, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

const NAV_ITEMS = [
  {
    name: 'Grocery',
    icon: 'shopping-cart',
    color: '#111827', // Black
    bg: '#FFFFFF',    // White
    subtitle: 'Shared shopping list',
  },
  {
    name: 'Expenses',
    icon: 'receipt-long',
    color: '#111827', // Black
    bg: '#FFFFFF',    // White
    subtitle: 'Split bills & balances',
  },
  {
    name: 'Chores',
    icon: 'cleaning-services',
    color: '#111827', // Black
    bg: '#FFFFFF',    // White
    subtitle: 'Assign household tasks',
  },
];

export default function DashboardScreen({ route }) {
  const navigation = useNavigation();
  const { householdId, householdData: initialData } = route.params || {};
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [userData, setUserData] = useState(null);
  const [householdData, setHouseholdData] = useState(initialData || null);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

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

  useEffect(() => {
    const fetchMemberProfiles = async () => {
      const m = householdData?.members || [];
      const profiles = {};
      for (const uid of m) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) profiles[uid] = snap.data();
        } catch (e) {
          console.error("Error fetching member profile:", e);
        }
      }
      setMemberProfiles(profiles);
    };
    fetchMemberProfiles();
  }, [householdData?.members]);

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

  const handleSendInvite = async () => {
    const input = inviteInput.trim().toLowerCase();
    if (!input) {
      Alert.alert("Error", "Please enter an email or username.");
      return;
    }
    setInviteLoading(true);
    try {
      const isEmail = input.includes('@');
      let targetUid = null;
      
      if (isEmail) {
        const q = query(collection(db, "users"), where("email", "==", input));
        const snap = await getDocs(q);
        if (!snap.empty) targetUid = snap.docs[0].id;
      } else {
        const snap = await getDoc(doc(db, "usernames", input));
        if (snap.exists()) targetUid = snap.data().uid;
      }

      if (!targetUid) {
        Alert.alert("Error", "User not found. Please check the email or username.");
        setInviteLoading(false);
        return;
      }

      if (members.includes(targetUid)) {
        Alert.alert("Notice", "This user is already a member of the household.");
        setInviteLoading(false);
        return;
      }

      const invitesRef = collection(db, "users", targetUid, "invites");
      const existingQ = query(invitesRef, where("householdId", "==", householdId), where("status", "==", "pending"));
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        Alert.alert("Notice", "An invitation is already pending for this user.");
        setInviteLoading(false);
        return;
      }

      await addDoc(invitesRef, {
        householdId,
        householdName: householdData.name,
        inviterEmail: userData?.email || auth.currentUser?.email || "Someone",
        status: "pending",
        createdAt: serverTimestamp()
      });

      Alert.alert("Success", "Invitation sent successfully!");
      setInviteInput('');
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to send invitation.");
    }
    setInviteLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
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
            className="w-[88%] rounded-[32px] p-6 border justify-start shadow-sm"
            style={{ backgroundColor: item.bg, borderColor: '#F3F4F6' }}
            onPress={() => handleNav(item.name)}
            activeOpacity={0.7}
          >
            <View 
              className="w-12 h-12 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: '#F9FAFB' }}
            >
              <MaterialIcons name={item.icon} size={28} color={item.color} />
            </View>
            <Text className="text-xl font-bold mb-1" style={{ color: item.color }}>
              {item.name}
            </Text>
            <Text className="text-sm font-medium text-textMuted">
              {item.subtitle}
            </Text>
            <View className="flex-row items-center mt-3">
               <Text className="text-xs font-bold text-textMuted tracking-widest mr-1">OPEN</Text>
               <MaterialIcons 
                name="arrow-forward" 
                size={14} 
                color="#9CA3AF" 
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Side Menu */}
      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity className="flex-1 bg-black/60" activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <View className="w-[78%] h-full bg-white px-6 border-r border-border shadow-2xl">
            <SafeAreaView className="flex-1">
              {/* Menu Header */}
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
                <Text className="text-textMuted text-xs font-medium">
                  {userData?.phoneNumber || 'No phone added'}
                </Text>
              </View>

              <View className="h-[1px] bg-border my-5" />

              {/* Selection Menu */}
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

              {/* Household Info */}
              <Text className="text-textMuted text-xs font-bold tracking-widest mb-3">HOUSEHOLD</Text>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="home" size={20} color="#6B7280" />
                <Text className="text-textMain text-base font-medium">{householdData?.name}</Text>
              </View>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="people" size={20} color="#6B7280" />
                <Text className="text-textMain text-base font-medium">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View className="h-[1px] bg-border my-5" />

              {/* Logout */}
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

      {/* Members Modal */}
      <Modal visible={isMembersModalVisible} transparent animationType="fade" onRequestClose={() => setIsMembersModalVisible(false)}>
        <TouchableOpacity className="flex-1 bg-black/60 items-center justify-center px-6" activeOpacity={1} onPress={() => setIsMembersModalVisible(false)}>
          <View className="w-full bg-white rounded-[40px] p-8 shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-2xl font-black text-textMain tracking-tight">Household Team</Text>
                <Text className="text-textMuted text-[10px] font-bold tracking-widest mt-1 uppercase">
                  {members.length} members total
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMembersModalVisible(false)} className="bg-background p-2 rounded-full border border-border">
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Invite Section */}
            <View className="mb-8 gap-4">
              <Text className="text-textMuted text-[10px] font-bold tracking-widest uppercase">Invite New Members</Text>
              
              {/* Box 1: Invite Code */}
              <View className="bg-secondary/40 rounded-[24px] p-5 border border-primary/5 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] text-textMuted font-bold uppercase mb-1">Invite Code</Text>
                  <Text className="text-2xl font-black text-primary tracking-widest uppercase">{householdData?.inviteCode}</Text>
                </View>
                <TouchableOpacity 
                   onPress={async () => {
                     if (householdData?.inviteCode) {
                       await Clipboard.setStringAsync(householdData.inviteCode);
                       Alert.alert("Copied", "Invite code copied to clipboard!");
                     }
                   }}
                   className="bg-primary px-5 py-3 rounded-2xl shadow-sm shadow-primary/20"
                >
                  <Text className="text-white font-bold text-xs uppercase tracking-wider">Copy</Text>
                </TouchableOpacity>
              </View>

              {/* Box 2: Invite Link */}
              <View className="bg-secondary/40 rounded-[24px] p-5 border border-primary/5 flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className="text-[10px] text-textMuted font-bold uppercase mb-1">Join Link</Text>
                  <Text className="text-[11px] text-textMain font-medium" numberOfLines={1}>
                    shared-living://join?code={householdData?.inviteCode}
                  </Text>
                </View>
                <TouchableOpacity 
                   onPress={async () => {
                     await Share.share({
                       message: `Join my household on Shared Living! Click here: shared-living://join?code=${householdData?.inviteCode}`,
                     });
                   }}
                   className="bg-white px-5 py-3 rounded-2xl border border-border shadow-sm"
                >
                  <Text className="text-textMain font-bold text-xs uppercase tracking-wider">Share</Text>
                </TouchableOpacity>
              </View>

              {/* Box 3: Invite by Email/Username */}
              <View className="bg-secondary/40 rounded-[24px] p-5 border border-primary/5 mt-2">
                <Text className="text-[10px] text-textMuted font-bold uppercase mb-3">Send Invite via App</Text>
                <View className="flex-row items-center gap-3">
                  <TextInput
                    className="flex-1 bg-white rounded-xl px-4 py-3 text-textMain text-sm border border-border"
                    placeholder="Email or Username"
                    placeholderTextColor="#9CA3AF"
                    value={inviteInput}
                    onChangeText={setInviteInput}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    onPress={handleSendInvite}
                    disabled={inviteLoading}
                    className="bg-primary px-5 py-3 rounded-xl shadow-sm shadow-primary/20 items-center justify-center min-w-[80px]"
                  >
                    {inviteLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text className="text-white font-bold text-xs uppercase tracking-wider">Send</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <ScrollView className="max-h-[60%]" showsVerticalScrollIndicator={false}>
              {members.map(uid => {
                const profile = memberProfiles[uid];
                const displayName = profile?.username ? `@${profile.username}` : (profile?.email?.split('@')[0] || '...');
                const initial = (profile?.username || profile?.email || '?').charAt(0).toUpperCase();
                const isMe = uid === auth.currentUser?.uid;

                return (
                  <View key={uid} className="flex-row items-center mb-5 last:mb-0">
                    <View className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${isMe ? 'border-primary bg-primary/10' : 'border-border bg-white'} shadow-sm mr-4`}>
                      <Text className={`font-bold text-lg ${isMe ? 'text-primary' : 'text-textMain'}`}>{initial}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-textMain">
                        {isMe ? 'You' : displayName} {uid === householdData?.createdBy && <Text className="text-primary text-[10px] font-black tracking-widest ml-1 uppercase">(Owner)</Text>}
                      </Text>
                      <Text className="text-xs text-textMuted font-medium">{profile?.email}</Text>
                    </View>
                    {isMe ? (
                       <View className="bg-success/10 px-2 py-1 rounded-md border border-success/20">
                          <Text className="text-success text-[10px] font-bold uppercase">Online</Text>
                       </View>
                    ) : (
                       isOwner && (
                         <TouchableOpacity 
                           onPress={() => handleRemoveMember(uid)}
                           className="w-10 h-10 rounded-xl bg-danger/10 items-center justify-center border border-danger/20"
                         >
                           <MaterialIcons name="person-remove" size={18} color="#EF4444" />
                         </TouchableOpacity>
                       )
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
