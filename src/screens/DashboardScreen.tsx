import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import { TimeWheelPicker } from '../components/TimeWheelPicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import SlideModal from '../components/SlideModal';
import { ActivitySkeleton } from '../components/Skeleton';
import * as Clipboard from 'expo-clipboard';
import { 
  doc, onSnapshot, updateDoc, arrayRemove, collection, query, orderBy, limit,
  addDoc, serverTimestamp 
} from 'firebase/firestore';
import { getActivityConfig } from '../utils/activityUtils';
import { getSyncedDate } from '../utils/timeUtils';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Activity } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const NAV_ITEMS = [
  {
    name: 'Grocery' as const,
    icon: 'shopping-cart' as const,
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Shared shopping list',
  },
  {
    name: 'Expenses' as const,
    icon: 'receipt-long' as const,
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Split bills & balances',
  },
  {
    name: 'Chores' as const,
    icon: 'cleaning-services' as const,
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Assign household tasks',
  },
  {
    name: 'Chat' as const,
    icon: 'chat' as const,
    color: '#111827',
    bg: '#FFFFFF',
    subtitle: 'Discuss with roommates',
  },
];

export default function DashboardScreen({ navigation, route }: Props) {
  const { householdId } = route.params;
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const { user, profile: userData } = useUser();
  const { householdData, memberProfiles } = useHousehold();

  const [editUsername, setEditUsername] = useState(userData?.username || '');
  
  const [trashCountdown, setTrashCountdown] = useState<string | null>(null);
  const [trashReminderSent, setTrashReminderSent] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<'all' | 'landlord' | 'wifi' | 'trash'>('all');
  const [isEditMode, setIsEditMode] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [chores, setChores] = useState<any[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (userData?.username) {
      setEditUsername(userData.username);
    }
  }, [userData?.username]);

  const handleUpdateProfile = async () => {
    if (!editUsername.trim() || !auth.currentUser) {
      Alert.alert('Error', 'Please enter a valid username');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username: editUsername.trim()
      });
      setIsProfileModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', 'Could not update profile: ' + e.message);
    }
  };

  useEffect(() => {
    if (!householdId) return;
    const unsub = onSnapshot(query(collection(db, 'households', householdId, 'activities'), orderBy('timestamp', 'desc'), limit(15)), (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      setLoadingActivities(false);
    });
    return unsub;
  }, [householdId]);

  // TRASH COUNTDOWN & NOTIFICATION LOGIC (NTP SYNCED)
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = getSyncedDate();

      const info = householdData?.info;
      if (!info?.trashArrivalTime) {
        setTrashCountdown(null);
        return;
      }

      const [h, m] = info.trashArrivalTime.split(':').map(Number);
      const arrival = new Date(now);
      arrival.setHours(h, m, 0, 0);

      const diff = arrival.getTime() - now.getTime();
      if (diff > 0 && diff < 3 * 60 * 60 * 1000) {
        const totalMins = Math.floor(diff / 60000);
        setTrashCountdown(`${totalMins}m`);

        if (totalMins === 10 && !trashReminderSent) {
          setTrashReminderSent(true);
          // Play buzzer sound
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }
            );
            await sound.playAsync();
          } catch (e) {
            console.error("Error playing buzzer:", e);
          }
          
          await addDoc(collection(db, 'households', householdId, 'messages'), {
            text: `🚚 TRASH ALERT: The truck is arriving in 10 minutes (${info.trashArrivalTime})! Get the bins ready!`,
            senderId: 'system',
            senderName: 'Trash Bot',
            createdAt: serverTimestamp(),
          });
        }
      } else {
        setTrashCountdown(null);
        if (diff < 0) setTrashReminderSent(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [householdData?.info, trashReminderSent, householdId]);

  useEffect(() => {
    if (!householdId) return;
    const q = query(
      collection(db, 'households', householdId, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
    });
    return unsub;
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !user?.uid) return;
    const q = query(
      collection(db, 'households', householdId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.some(doc => {
        const data = doc.data();
        return data.senderId !== user.uid && (!data.readBy || !data.readBy.includes(user.uid));
      });
      setHasUnreadMessages(unread);
    });
    return unsub;
  }, [householdId, user?.uid]);

  useEffect(() => {
    if (!householdId) return;
    const q = query(
      collection(db, 'households', householdId, 'chores'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [householdId]);

  useEffect(() => {
    const checkUpcomingChores = async () => {
      if (!householdId || chores.length === 0) return;
      const now = getSyncedDate();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' });
      for (const chore of chores) {
        if (chore.done || chore.reminderSent) continue;
        if (chore.day && !chore.day.includes(currentDay)) continue;
        try {
          const timeParts = (chore.time || "").split(' ');
          if (timeParts.length < 2) continue;
          const [timePart, period] = timeParts;
          const [hours, minutes] = timePart.split(':').map(Number);
          let h = hours % 12;
          if (period.toUpperCase() === 'PM') h += 12;
          const choreTime = new Date();
          choreTime.setHours(h, minutes, 0, 0);
          const diffInMs = choreTime.getTime() - now.getTime();
          const diffInMins = diffInMs / (1000 * 60);
          if (diffInMins > 0 && diffInMins <= 5.1) {
             const profile = memberProfiles[chore.assignedToUid];
             const assigneeName = profile?.username ? `${profile.username}` : 'Member';
             await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), { reminderSent: true });
             await addDoc(collection(db, 'households', householdId, 'messages'), {
               text: `⏰ ${assigneeName}, don't forget to ${chore.title} in 5 minutes`,
               senderId: 'system',
               senderName: 'Household Assistant',
               createdAt: serverTimestamp(),
             });
          }
        } catch (e) {
          console.error("Error in Dashboard reminder engine:", e);
        }
      }
    };
    const interval = setInterval(checkUpcomingChores, 30000);
    return () => clearInterval(interval);
  }, [chores, householdId, memberProfiles]);

  const members = householdData?.members || [];
  const isOwner = householdData?.createdBy === auth.currentUser?.uid;

  const handleRemoveMember = async (memberUid: string) => {
    const profile = memberProfiles[memberUid];
    const name = profile?.username ? `${profile.username}` : (profile?.email || 'this member');
    Alert.alert("Remove Member", `Are you sure you want to remove ${name} from the household?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await updateDoc(doc(db, 'households', householdId), { members: arrayRemove(memberUid) });
        } catch (e: any) { Alert.alert("Error", "Could not remove member: " + e.message); }
      }}
    ]);
  };

  const handleNav = (screenName: 'Grocery' | 'Expenses' | 'Chores' | 'Chat') => {
    navigation.navigate(screenName, { householdId, members });
  };

  const handleUpdateInfo = async (newInfo: any) => {
    if (!householdId) return;
    try {
      await updateDoc(doc(db, 'households', householdId), { info: newInfo });
      setIsInfoModalVisible(false);
      setIsEditMode(false);
      Alert.alert('Success', 'Household info updated!');
    } catch (e: any) {
      Alert.alert('Error', 'Could not update: ' + e.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-slate-100">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
             <View className="w-10 h-10 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-200">
                <MaterialIcons name="menu" size={24} color="white" />
             </View>
          </TouchableOpacity>
          <View>
            <Text className="text-textMain text-xl font-black tracking-tight">{householdData?.name || 'My Home'}</Text>
            <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest">Household Hub</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => setIsMembersModalVisible(true)}
          className="w-10 h-10 rounded-2xl bg-slate-50 items-center justify-center border border-slate-100"
        >
          <MaterialIcons name="people" size={24} color="#4B5563" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40, flexGrow: 1, paddingHorizontal: 24, paddingTop: 20 }}>
        {/* Household Info Board / Digital Fridge */}
        <View className="bg-indigo-600 rounded-[32px] p-6 mb-8 shadow-xl shadow-indigo-200 overflow-hidden">
          <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
          <View className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/5 rounded-full" />
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-row items-center gap-2">
              <View className="bg-white/20 p-2 rounded-xl">
                <MaterialIcons name="dashboard-customize" size={18} color="white" />
              </View>
              <Text className="text-white text-xs font-black uppercase tracking-widest">Home Whiteboard</Text>
            </View>
            <TouchableOpacity onPress={() => { setInfoModalTab('all'); setIsEditMode(true); setIsInfoModalVisible(true); }} className="bg-white/20 p-2 rounded-full">
               <MaterialIcons name="edit" size={14} color="white" />
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => { setInfoModalTab('landlord'); setIsEditMode(false); setIsInfoModalVisible(true); }} className="flex-1 bg-white/10 rounded-2xl py-3 px-4 border border-white/10 flex-row items-center">
              <MaterialIcons name="phone-in-talk" size={16} color="white" />
              <Text className="text-white text-[11px] font-black ml-2" numberOfLines={1}>{householdData?.info?.landlordName || 'Contact'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setInfoModalTab('wifi'); setIsEditMode(false); setIsInfoModalVisible(true); }} className="flex-1 bg-white/10 rounded-2xl py-3 px-4 border border-white/10 flex-row items-center">
              <MaterialIcons name="wifi" size={16} color="white" />
              <Text className="text-white text-[11px] font-black ml-2" numberOfLines={1}>{householdData?.info?.wifiName || 'WiFi'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => { setInfoModalTab('trash'); setIsEditMode(false); setIsInfoModalVisible(true); }} 
              className={`flex-1 rounded-2xl py-3 px-4 border flex-row items-center ${trashCountdown && parseInt(trashCountdown) <= 10 ? 'bg-red-500 border-red-400' : 'bg-white/10 border-white/10'}`}
            >
              <MaterialIcons name="delete-outline" size={16} color="white" />
              <Text className="text-white text-[11px] font-black ml-2" numberOfLines={1}>{trashCountdown || 'Trash'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Feed */}
        <View className="mb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-textMuted text-[10px] font-bold tracking-[2px] uppercase ml-1">{"What's Happening"}</Text>
            <View className="w-1.5 h-1.5 rounded-full bg-success" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" contentContainerStyle={{ paddingHorizontal: 4 }}>
            {loadingActivities ? (
              [1, 2, 3].map((i) => <ActivitySkeleton key={i} />)
            ) : activities.length > 0 ? (
              activities.map((activity, idx) => {
                const config = getActivityConfig(activity.type);
                return (
                  <Card key={activity.id || idx} className="bg-slate-50 p-4 rounded-[28px] mr-3 border-slate-100 flex-row items-center gap-4 min-w-[240px] shadow-none mb-0">
                    <View style={{ backgroundColor: config.color + '15' }} className="p-3 rounded-2xl">
                       <MaterialIcons name={config.icon} size={20} color={config.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-textMain font-black text-sm" numberOfLines={1}>{activity.userName} <Text className="text-textMuted font-medium">{config.label}</Text></Text>
                      <Text className="text-textMuted text-[10px] font-bold mt-0.5">{activity.createdAt?.toDate ? activity.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</Text>
                    </View>
                    {activity.amount > 0 && <View className="bg-white px-3 py-1.5 rounded-xl border border-slate-100"><Text className="text-indigo-600 font-black text-xs">₹{activity.amount}</Text></View>}
                  </Card>
                );
              })
            ) : (
              <Card className="bg-slate-50 p-6 rounded-[28px] border-slate-100 items-center justify-center w-full min-h-[80px] shadow-none mb-0">
                <Text className="text-textMuted text-xs font-bold uppercase tracking-widest">No Recent Activity</Text>
              </Card>
            )}
          </ScrollView>
        </View>

        {/* Quick Nav Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {NAV_ITEMS.map((item) => (
            <Card 
              key={item.name} 
              onPress={() => handleNav(item.name)} 
              style={{ width: '48%' }} 
              className="p-5 border-slate-100 shadow-sm mb-4"
            >
              <View className="flex-row justify-between items-start mb-6">
                <View className="bg-indigo-600/10 p-3 rounded-2xl"><MaterialIcons name={item.icon} size={22} color="#4F46E5" /></View>
                <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100"><MaterialIcons name="chevron-right" size={18} color="#9CA3AF" /></View>
              </View>
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Text className="text-textMain text-base font-black tracking-tight">{item.name}</Text>
                  {item.name === 'Chat' && hasUnreadMessages && <View className="w-2 h-2 rounded-full bg-error" />}
                </View>
                <Text className="text-textMuted text-[10px] font-bold leading-4" numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Menu Modal */}
      <SlideModal visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} title="Menu">
        <View className="gap-3">
          <TouchableOpacity onPress={() => { setIsMenuVisible(false); setIsProfileModalVisible(true); }} className="flex-row items-center gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
            <View className="bg-emerald-100 p-2.5 rounded-xl"><MaterialIcons name="person" size={22} color="#10B981" /></View>
            <View><Text className="text-textMain font-black">My Profile</Text><Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">Edit display name</Text></View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setIsMenuVisible(false); auth.signOut(); }} className="flex-row items-center gap-4 bg-rose-50 p-5 rounded-3xl border border-rose-100 mt-2">
            <View className="bg-rose-100 p-2.5 rounded-xl"><MaterialIcons name="logout" size={22} color="#EF4444" /></View>
            <View><Text className="text-rose-600 font-black">Sign Out</Text><Text className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Exit account</Text></View>
          </TouchableOpacity>
        </View>
      </SlideModal>

      {/* Members Modal */}
      <SlideModal visible={isMembersModalVisible} onClose={() => setIsMembersModalVisible(false)} title="House Team">
        <View className="bg-indigo-600 rounded-[32px] p-6 mb-6 shadow-lg shadow-indigo-200">
           <Text className="text-white/70 text-[10px] font-bold uppercase tracking-[2px] mb-2">Invite Code</Text>
           <View className="flex-row justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
              <Text className="text-white text-2xl font-black tracking-[4px]">{householdData?.inviteCode}</Text>
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(householdData?.inviteCode || ''); Alert.alert('Copied!', 'Invite code copied'); }} className="bg-white/20 p-2 rounded-xl">
                <MaterialIcons name="content-copy" size={20} color="white" />
              </TouchableOpacity>
           </View>
        </View>
        <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Current Members</Text>
        <View className="gap-3 mb-6">
          {Object.entries(memberProfiles).map(([uid, member]: [string, any]) => (
            <View key={uid} className="flex-row items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <Avatar name={member.username || 'Member'} size={48} bgColor="#FFFFFF" color="#4F46E5" style={{ borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }} />
              <View className="flex-1">                <Text className="text-textMain font-black">{member.username || 'Unknown Member'}</Text>
                <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mt-0.5">{uid === auth.currentUser?.uid ? 'You' : 'Member'}</Text>
              </View>
              {isOwner && uid !== auth.currentUser?.uid && (
                <TouchableOpacity onPress={() => handleRemoveMember(uid)} className="p-2">
                  <MaterialIcons name="person-remove" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </SlideModal>

      {/* Profile Edit Modal */}
      <SlideModal visible={isProfileModalVisible} onClose={() => setIsProfileModalVisible(false)} title="My Profile">
        <View className="gap-6">
          <View>
            <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Display Name</Text>
            <TextInput className="bg-slate-50 rounded-[28px] p-5 text-textMain font-black border border-slate-100" placeholder="Your Name" value={editUsername} onChangeText={setEditUsername} />
          </View>
          <TouchableOpacity onPress={handleUpdateProfile} className="bg-indigo-600 rounded-[28px] py-5 items-center shadow-lg shadow-indigo-200">
            <Text className="text-white font-black text-base uppercase tracking-widest">Update Profile</Text>
          </TouchableOpacity>
        </View>
      </SlideModal>

      {/* Info Modal */}
      <SlideModal visible={isInfoModalVisible} onClose={() => { setIsInfoModalVisible(false); setIsEditMode(false); }} title={isEditMode ? "Edit Board" : "Household Info"}>
        <HouseholdInfoModalContent 
          tab={infoModalTab} 
          isEdit={isEditMode} 
          data={householdData?.info}
          onSave={handleUpdateInfo}
        />
      </SlideModal>
    </SafeAreaView>
  );
}

const HouseholdInfoModalContent = memo(({ tab, isEdit, data, onSave }: any) => {
  const [wifiName, setWifiName] = useState(data?.wifiName || '');
  const [wifiPass, setWifiPass] = useState(data?.wifiPass || '');
  const [trashArrivalTime, setTrashArrivalTime] = useState(data?.trashArrivalTime || '');
  const [landlordName, setLandlordName] = useState(data?.landlordName || '');
  const [landlordPhone, setLandlordPhone] = useState(data?.landlordPhone || '');
  const [otherInfo, setOtherInfo] = useState(data?.other || '');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSave = () => {
    onSave({ wifiName, wifiPass, trashArrivalTime, landlordName, landlordPhone, other: otherInfo });
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Copied to clipboard');
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
        <View className="gap-5">
          {(tab === 'all' || tab === 'landlord') && (
            <View className="bg-white rounded-3xl p-5 border border-border shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-success/10 p-2 rounded-lg"><MaterialIcons name="phone-in-talk" size={20} color="#10B981" /></View>
                <Text className="text-textMain font-bold">Landlord / Maintenance</Text>
              </View>
              {isEdit ? (
                <>
                  <TextInput className="bg-background rounded-xl p-3 text-textMain font-bold mb-3 border border-border/50" placeholder="Name" value={landlordName} onChangeText={setLandlordName} />
                  <TextInput className="bg-background rounded-xl p-3 text-textMain font-bold border border-border/50" placeholder="Phone Number" value={landlordPhone} onChangeText={setLandlordPhone} keyboardType="phone-pad" />
                </>
              ) : (
                <View className="gap-2">
                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Name</Text>
                    <Text className="text-textMain font-black text-lg">{landlordName || 'Not Set'}</Text>
                  </View>
                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-row items-center justify-between">
                    <View><Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Phone</Text><Text className="text-textMain font-black text-lg">{landlordPhone || 'Not Set'}</Text></View>
                    {landlordPhone && (
                      <TouchableOpacity className="bg-success w-10 h-10 rounded-full items-center justify-center shadow-lg shadow-success/30" onPress={() => {}}>
                        <MaterialIcons name="call" size={20} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {(tab === 'all' || tab === 'wifi') && (
            <View className="bg-white rounded-3xl p-5 border border-border shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-primary/10 p-2 rounded-lg"><MaterialIcons name="wifi" size={20} color="#4F46E5" /></View>
                <Text className="text-textMain font-bold">WiFi Details</Text>
              </View>
              {isEdit ? (
                <>
                  <TextInput className="bg-background rounded-xl p-3 text-textMain font-bold mb-3 border border-border/50" placeholder="WiFi Name" value={wifiName} onChangeText={setWifiName} />
                  <TextInput className="bg-background rounded-xl p-3 text-textMain font-bold border border-border/50" placeholder="Password" value={wifiPass} onChangeText={setWifiPass} />
                </>
              ) : (
                <View className="gap-2">
                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Network</Text><Text className="text-textMain font-black text-lg">{wifiName || 'Not Set'}</Text></View>
                  <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-row items-center justify-between">
                    <View><Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Password</Text><Text className="text-textMain font-black text-lg">{wifiPass || 'Not Set'}</Text></View>
                    <TouchableOpacity className="bg-slate-200 w-10 h-10 rounded-full items-center justify-center" onPress={() => copyToClipboard(wifiPass)}><MaterialIcons name="content-copy" size={18} color="#4B5563" /></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {(tab === 'all' || tab === 'trash') && (
            <View className="bg-white rounded-3xl p-5 border border-border shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-warning/10 p-2 rounded-lg"><MaterialIcons name="delete-outline" size={20} color="#D97706" /></View>
                <Text className="text-textMain font-bold">Trash & Utilities</Text>
              </View>
              <Text className="text-textMuted text-[10px] font-bold uppercase mb-2 ml-1">Arrival Time</Text>
              {isEdit ? (
                <TouchableOpacity onPress={() => setShowTimePicker(true)} className={`flex-row items-baseline rounded-xl px-4 py-2 ${showTimePicker ? 'bg-primary/5' : 'bg-background border border-border/50'}`}>
                  {trashArrivalTime ? (
                    <>
                      <Text className="text-xl font-black text-textMain">{trashArrivalTime.split(':')[0]}</Text>
                      <Text className="text-base font-black text-textMuted mx-0.5">:</Text>
                      <Text className="text-xl font-black text-textMain">{trashArrivalTime.split(':')[1]}</Text>
                      <Text className="text-[10px] font-black text-textMuted ml-1 uppercase">{parseInt(trashArrivalTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}</Text>
                    </>
                  ) : (<Text className="text-textMuted font-bold py-1">Set Time</Text>)}
                  <View className="flex-1" /><MaterialIcons name="access-time" size={20} color="#4F46E5" />
                </TouchableOpacity>
              ) : (
                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-row items-baseline">
                  <Text className="text-3xl font-black text-textMain">{trashArrivalTime ? trashArrivalTime.split(':')[0] : '--'}</Text>
                  <Text className="text-xl font-black text-textMuted mx-1">:</Text>
                  <Text className="text-3xl font-black text-textMain">{trashArrivalTime ? trashArrivalTime.split(':')[1] : '--'}</Text>
                  <Text className="text-xs font-black text-textMuted ml-1 uppercase">{trashArrivalTime ? (parseInt(trashArrivalTime.split(':')[0]) >= 12 ? 'PM' : 'AM') : ''}</Text>
                </View>
              )}
              {showTimePicker && (
                <Modal visible={showTimePicker} transparent animationType="fade">
                  <TouchableOpacity className="flex-1 bg-black/40 justify-center items-center px-6" activeOpacity={1} onPress={() => setShowTimePicker(false)}>
                    <TouchableOpacity activeOpacity={1} className="w-full bg-white rounded-[32px] p-6 shadow-2xl" onPress={(e) => e.stopPropagation()}>
                      <TimeWheelPicker 
                        initialTime={(() => { if (!trashArrivalTime) return getSyncedDate(); const [h, m] = trashArrivalTime.split(':').map(Number); const d = getSyncedDate(); d.setHours(h, m, 0, 0); return d; })()}
                        onConfirm={(date) => { const hours = date.getHours().toString().padStart(2, '0'); const minutes = date.getMinutes().toString().padStart(2, '0'); setTrashArrivalTime(`${hours}:${minutes}`); setShowTimePicker(false); }}
                        onCancel={() => setShowTimePicker(false)}
                      />
                      <TouchableOpacity onPress={() => setShowTimePicker(false)} className="mt-4 py-3 items-center"><Text className="text-textMuted font-bold text-sm">Cancel</Text></TouchableOpacity>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Modal>
              )}
            </View>
          )}

          {tab === 'all' && (
            <View className="bg-white rounded-3xl p-5 border border-border shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-slate-100 p-2 rounded-lg"><MaterialIcons name="description" size={20} color="#6B7280" /></View>
                <Text className="text-textMain font-bold">House Rules</Text>
              </View>
              {isEdit ? (
                <TextInput className="bg-background rounded-xl p-3 text-textMain font-medium border border-border/50 min-h-[100px]" placeholder="Rules..." multiline numberOfLines={4} textAlignVertical="top" value={otherInfo} onChangeText={setOtherInfo} />
              ) : (
                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[60px]"><Text className="text-textMain font-medium leading-6">{otherInfo || 'None'}</Text></View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      {isEdit && (
        <TouchableOpacity onPress={handleSave} className="bg-indigo-600 rounded-2xl py-4 items-center shadow-lg shadow-indigo-300 mb-8">
          <Text className="text-white font-black text-lg">Save Changes</Text>
        </TouchableOpacity>
      )}
    </>
  );
});
HouseholdInfoModalContent.displayName = 'HouseholdInfoModalContent';
