import React, { useState, useEffect, memo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, TextInput, Image } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { TimeWheelPicker } from '../components/TimeWheelPicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import SlideModal from '../components/SlideModal';
import { ActivitySkeleton, Skeleton } from '../components/Skeleton';
import * as Clipboard from 'expo-clipboard';
import { 
  doc, onSnapshot, updateDoc, arrayRemove, collection, query, orderBy, limit,
  addDoc, serverTimestamp, where
} from 'firebase/firestore';
import { getActivityConfig } from '../utils/activityUtils';
import { getSyncedDate } from '../utils/timeUtils';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Activity } from '../types';

type Props = { navigation: any; route?: any };

const NAV_ITEMS = [
  { name: 'Grocery' as const,  icon: 'shopping-cart' as const,     iconBg: '#065F46', cardBg: '#059669', subtitle: 'Shared shopping list' },
  { name: 'Expenses' as const, icon: 'account-balance-wallet' as const, iconBg: '#581C87', cardBg: '#7C3AED', subtitle: 'Split bills & balances' },
  { name: 'Chores' as const,   icon: 'cleaning-services' as const, iconBg: '#92400E', cardBg: '#D97706', subtitle: 'Assign household tasks' },
  { name: 'Chat' as const,     icon: 'chat' as const,              iconBg: '#1E3A5F', cardBg: '#2563EB', subtitle: 'Discuss with roommates' },
];

export default function DashboardScreen({ navigation }: Props) {
  const { householdId, setHouseholdId } = useHousehold();
  const hid = householdId ?? '';
  const { isDark } = useTheme();
  const bg      = isDark ? '#0F172A' : '#FFFFFF';
  const surface = isDark ? '#1E293B' : '#F8FAFC';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? '#94A3B8' : '#64748B';
  const bord    = isDark ? '#334155' : '#E2E8F0';
  const { showToast } = useToast();
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
      showToast('Enter valid username', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username: editUsername.trim()
      });
      setIsProfileModalVisible(false);
      showToast('Profile updated', 'success');
    } catch (e: any) {
      showToast('Could not update profile', 'error');
    }
  };

  useEffect(() => {
    if (!householdId) return;
    setLoadingActivities(true);
    const q = query(
      collection(db, 'households', hid, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
      setLoadingActivities(false);
    }, (err) => {
      console.error("Error subscribing to activities:", err);
      setLoadingActivities(false);
    });
    return unsub;
  }, [householdId]);

  // TRASH COUNTDOWN & NOTIFICATION LOGIC (NTP SYNCED)
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!householdId) return;
    
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
          try {
            const player = createAudioPlayer({ uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' });
            player.play();
            
            if (isMounted.current) {
              await addDoc(collection(db, 'households', hid, 'messages'), {
                text: `🚚 TRASH ALERT: The truck is arriving in 10 minutes (${info.trashArrivalTime})! Get the bins ready!`,
                senderId: 'system',
                senderName: 'Trash Bot',
                createdAt: serverTimestamp(),
              });
            }
          } catch (e) {
            console.error("Error in trash reminder:", e);
          }
        }
      } else {
        setTrashCountdown(null);
        // Reset reminder flag once truck passes or is far away
        if (diff < 0 || diff > 15 * 60 * 1000) {
          setTrashReminderSent(false);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [householdData?.info, trashReminderSent, householdId]);

  useEffect(() => {
    if (!householdId || !user?.uid) return;
    const q = query(
      collection(db, 'households', hid, 'messages'),
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
      collection(db, 'households', hid, 'chores'),
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
             await updateDoc(doc(db, 'households', hid, 'chores', chore.id), { reminderSent: true });
             await addDoc(collection(db, 'households', hid, 'messages'), {
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
          await updateDoc(doc(db, 'households', hid), { members: arrayRemove(memberUid) });
          showToast('Member removed', 'success');
        } catch (e: any) { showToast('Could not remove member', 'error'); }
      }}
    ]);
  };

  // Tab navigation — no params needed, householdId is in context
  const handleNav = (screenName: 'Grocery' | 'Expenses' | 'Chores' | 'Chat') => {
    navigation.navigate(screenName);
  };

  const [householdsList, setHouseholdsList] = useState<{id: string, name: string}[]>([]);
  const [isSwitchModalVisible, setIsSwitchModalVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'households'), where('members', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setHouseholdsList(snap.docs.map(d => ({ id: d.id, name: d.data().name || 'Unnamed Household' })));
    });
    return unsub;
  }, [user?.uid]);

  const handleUpdateInfo = async (updates: any) => {
    if (!householdId) return;
    try {
      const { name, info } = updates;
      await updateDoc(doc(db, 'households', hid), { name, info });
      setIsInfoModalVisible(false);
      setIsEditMode(false);
      showToast('Info updated', 'success');
    } catch (e: any) {
      showToast('Could not update', 'error');
    }
  };


  const bgColors = isDark 
    ? ['#0A1128', '#0F1A3A'] as readonly [string, string]
    : ['#FFFFFF', '#FFFFFF'] as readonly [string, string];
  const textMain = isDark ? '#FFFFFF' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#4F46E5';
  const glassBorder = isDark ? 'rgba(255,255,255,0.1)' : '#DBEAFE';
  const glassBg = isDark ? 'rgba(255,255,255,0.1)' : '#EFF6FF';
  const blurTint = isDark ? 'light' : 'light';

  // Dynamic grid card values
  const cardIntensity = isDark ? 30 : 0;
  const groceryBorder = isDark ? 'rgba(16, 185, 129, 0.3)' : '#059669';
  const groceryGrad   = isDark 
    ? ['rgba(6, 95, 70, 0.7)', 'rgba(5, 150, 105, 0.2)'] as const 
    : ['#10B981', '#059669'] as const;

  const expenseBorder = isDark ? 'rgba(139, 92, 246, 0.3)' : '#7C3AED';
  const expenseGrad   = isDark 
    ? ['rgba(88, 28, 135, 0.7)', 'rgba(124, 58, 237, 0.2)'] as const 
    : ['#8B5CF6', '#7C3AED'] as const;

  const choresBorder  = isDark ? 'rgba(217, 119, 6, 0.3)' : '#D97706';
  const choresGrad    = isDark 
    ? ['rgba(146, 64, 14, 0.7)', 'rgba(217, 119, 6, 0.2)'] as const 
    : ['#F59E0B', '#D97706'] as const;

  const chatBorder    = isDark ? 'rgba(59, 130, 246, 0.3)' : '#2563EB';
  const chatGrad      = isDark 
    ? ['rgba(30, 58, 138, 0.7)', 'rgba(37, 99, 235, 0.2)'] as const 
    : ['#3B82F6', '#2563EB'] as const;

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Avatar name={userData?.username || 'U'} size={48} bgColor="#FFFFFF" color="#0A1128" style={{ borderRadius: 24 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSwitchModalVisible(true)}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: textMuted }}>Good evening,</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: textMain }}>{householdData?.name || 'Loading...'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setIsMembersModalVisible(true)}>
              <BlurView intensity={20} tint={blurTint} style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                <MaterialIcons name="people" size={24} color={textMuted} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}}>
              <BlurView intensity={20} tint={blurTint} style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                <MaterialIcons name="notifications" size={24} color={textMuted} />
                <View style={{ position: 'absolute', top: 12, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: '#60A5FA', borderWidth: 1, borderColor: isDark ? '#0A1128' : '#DBEAFE' }} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Activity Feed pills */}
          <View style={{ marginTop: 12, marginBottom: 24 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
              {loadingActivities ? (
                [1, 2, 3].map(i => (
                  <BlurView key={i} intensity={15} tint={blurTint} style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: glassBg }} />
                    <View>
                      <View style={{ width: 80, height: 10, borderRadius: 4, backgroundColor: glassBg, marginBottom: 4 }} />
                      <View style={{ width: 50, height: 8, borderRadius: 4, backgroundColor: glassBg }} />
                    </View>
                  </BlurView>
                ))
              ) : activities.length > 0 ? (
                activities.slice(0, 6).map((activity, idx) => {
                  const config = getActivityConfig(activity.type);
                  return (
                    <BlurView key={activity.id || idx} intensity={15} tint={blurTint} style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                      <View style={{ backgroundColor: glassBg, padding: 8, borderRadius: 8 }}>
                        <MaterialIcons name={config.icon} size={16} color={textMain} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: textMain }} numberOfLines={1}>{activity.userName} {config.label.toLowerCase()}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: textMuted }}>{activity.createdAt?.toDate ? activity.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Just now'}</Text>
                      </View>
                    </BlurView>
                  );
                })
              ) : (
                  <BlurView intensity={15} tint={blurTint} style={{ borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textMuted }}>No recent activity</Text>
                </BlurView>
              )}
            </ScrollView>
          </View>

          {/* Household Info Banner Card */}
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <BlurView intensity={20} tint={blurTint} style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
              <LinearGradient colors={[glassBg, 'rgba(255,255,255,0.02)']} style={{ padding: 20 }}>
                {/* Top Row: Name and Edit Icon */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: textMain }}>{householdData?.name || 'My Household'}</Text>
                  <TouchableOpacity onPress={() => { setInfoModalTab('all'); setIsEditMode(true); setIsInfoModalVisible(true); }} style={{ padding: 4 }}>
                    <MaterialIcons name="edit" size={20} color={textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Info Grid */}
                <View style={{ gap: 12 }}>
                  {/* WiFi */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialIcons name="wifi" size={18} color="#6366F1" />
                      <View>
                        <Text style={{ fontSize: 11, color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>WiFi Network</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: textMain }}>{householdData?.info?.wifiName || 'Not Set'}</Text>
                      </View>
                    </View>
                    {householdData?.info?.wifiPass ? (
                      <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(householdData?.info?.wifiPass || ''); showToast('Password copied', 'success'); }} style={{ padding: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 10 }}>
                        <MaterialIcons name="content-copy" size={14} color={textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Landlord & Trash Row */}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {/* Landlord */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 16 }}>
                      <MaterialIcons name="phone-in-talk" size={18} color="#10B981" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Landlord</Text>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: textMain }}>{householdData?.info?.landlordName || 'Not Set'}</Text>
                      </View>
                    </View>

                    {/* Trash */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: 12, borderRadius: 16 }}>
                      <MaterialIcons name="delete-outline" size={18} color="#FBBF24" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>Trash Truck</Text>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: textMain }}>{householdData?.info?.trashArrivalTime || 'Not Set'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </BlurView>
          </View>

          {/* 4 Cards Grid */}
          <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
            {/* Grocery */}
            <TouchableOpacity onPress={() => handleNav('Grocery')} style={{ width: '47%', aspectRatio: 1 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: groceryBorder }}>
                <LinearGradient colors={groceryGrad} style={{ flex: 1, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Grocery</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
                      <MaterialIcons name="shopping-cart" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="shopping-cart" size={80} color="rgba(255, 255, 255, 0.15)" style={{ position: 'absolute', bottom: -10, right: -10 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Expenses */}
            <TouchableOpacity onPress={() => handleNav('Expenses')} style={{ width: '47%', aspectRatio: 1 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: expenseBorder }}>
                <LinearGradient colors={expenseGrad} style={{ flex: 1, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Expenses</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
                      <MaterialIcons name="attach-money" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="bar-chart" size={80} color="rgba(255, 255, 255, 0.15)" style={{ position: 'absolute', bottom: -10, right: -10 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Chores */}
            <TouchableOpacity onPress={() => handleNav('Chores')} style={{ width: '47%', aspectRatio: 1 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: choresBorder }}>
                <LinearGradient colors={choresGrad} style={{ flex: 1, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Chores</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
                      <MaterialIcons name="cleaning-services" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="format-list-bulleted" size={80} color="rgba(255, 255, 255, 0.15)" style={{ position: 'absolute', bottom: -10, right: -10 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Chat */}
            <TouchableOpacity onPress={() => handleNav('Chat')} style={{ width: '47%', aspectRatio: 1 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: chatBorder }}>
                <LinearGradient colors={chatGrad} style={{ flex: 1, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Chat</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
                      <MaterialIcons name="chat" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="chat" size={80} color="rgba(255, 255, 255, 0.15)" style={{ position: 'absolute', bottom: -10, right: -10 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>
          </View>
        </ScrollView>


      {/* Modals are kept below but wrapped nicely to ensure context isn't broken */}
      {/* Menu Modal */}
      <SlideModal visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} title="Menu">
        <View className="gap-3">
          <TouchableOpacity onPress={() => { setIsMenuVisible(false); setIsProfileModalVisible(true); }} className="flex-row items-center gap-4 bg-surfaceRaised p-5 rounded-3xl border border-border/50">
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
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(householdData?.inviteCode || ''); showToast('Code copied', 'success'); }} className="bg-white/20 p-2 rounded-xl">
                <MaterialIcons name="content-copy" size={20} color="white" />
              </TouchableOpacity>
           </View>
        </View>
        <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Current Members</Text>
        <View className="gap-3 mb-6">
          {Object.entries(memberProfiles).map(([uid, member]: [string, any]) => (
            <View key={uid} className="flex-row items-center gap-4 bg-surfaceRaised p-4 rounded-3xl border border-border/50">
              <Avatar name={member.username || 'Member'} size={48} bgColor="#FFFFFF" color="#4F46E5" style={{ borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }} />
              <View className="flex-1">
                <Text className="text-textMain font-black">{member.username || 'Unknown Member'}</Text>
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
            <TextInput className="bg-surfaceRaised rounded-[28px] p-5 text-textMain font-black border border-border/50" placeholder="Your Name" value={editUsername} onChangeText={setEditUsername} />
          </View>
          <TouchableOpacity onPress={handleUpdateProfile} className="bg-indigo-600 rounded-[28px] py-5 items-center shadow-lg shadow-indigo-200">
            <Text className="text-white font-black text-base uppercase tracking-widest">Update Profile</Text>
          </TouchableOpacity>
        </View>
      </SlideModal>

      {/* Info Modal */}
      <SlideModal visible={isInfoModalVisible} onClose={() => { setIsInfoModalVisible(false); setIsEditMode(false); }} title={isEditMode ? "Edit Household" : "Household Info"}>
        <HouseholdInfoModalContent 
          tab={infoModalTab} 
          isEdit={isEditMode} 
          data={householdData?.info}
          householdName={householdData?.name}
          onSave={handleUpdateInfo}
        />
      </SlideModal>

      {/* Switch Household Modal */}
      <SlideModal visible={isSwitchModalVisible} onClose={() => setIsSwitchModalVisible(false)} title="Switch Household">
        <View style={{ gap: 12, paddingBottom: 24 }}>
          {householdsList.map(h => (
            <TouchableOpacity 
              key={h.id}
              onPress={() => {
                setHouseholdId(h.id);
                setIsSwitchModalVisible(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: h.id === householdId ? '#6366F1' : bord }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: h.id === householdId ? '#6366F1' : (isDark ? '#334155' : '#E2E8F0'), alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialIcons name="home" size={20} color={h.id === householdId ? '#FFFFFF' : muted} />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: h.id === householdId ? (isDark ? '#F1F5F9' : '#0F172A') : text }}>{h.name}</Text>
              {h.id === householdId && <MaterialIcons name="check-circle" size={24} color="#6366F1" />}
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity 
            onPress={() => {
              setIsSwitchModalVisible(false);
              navigation.navigate('HouseholdSelection');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8, backgroundColor: isDark ? '#334155' : '#F1F5F9', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: muted }}
          >
            <MaterialIcons name="add" size={20} color={muted} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: muted }}>Create or Join Another</Text>
          </TouchableOpacity>
        </View>
      </SlideModal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const HouseholdInfoModalContent = memo(({ tab, isEdit, data, householdName, onSave }: any) => {
  const { showToast } = useToast();
  const [name, setName] = useState(householdName || '');
  const [wifiName, setWifiName] = useState(data?.wifiName || '');
  const [wifiPass, setWifiPass] = useState(data?.wifiPass || '');
  const [trashArrivalTime, setTrashArrivalTime] = useState(data?.trashArrivalTime || '');
  const [landlordName, setLandlordName] = useState(data?.landlordName || '');
  const [landlordPhone, setLandlordPhone] = useState(data?.landlordPhone || '');
  const [otherInfo, setOtherInfo] = useState(data?.other || '');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleSave = () => {
    onSave({ name: name.trim() || 'My Household', info: { wifiName, wifiPass, trashArrivalTime, landlordName, landlordPhone, other: otherInfo } });
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast('Copied', 'success');
  };

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
        <View className="gap-5">
          {tab === 'all' && isEdit && (
            <View className="bg-surface rounded-3xl p-5 border border-border shadow-sm">
              <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Household Name</Text>
              <TextInput className="bg-background rounded-xl p-3 text-textMain font-bold border border-border/50" placeholder="Household Name" value={name} onChangeText={setName} />
            </View>
          )}

          {(tab === 'all' || tab === 'landlord') && (
            <View className="bg-surface rounded-3xl p-5 border border-border shadow-sm">
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
                  <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50">
                    <Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Name</Text>
                    <Text className="text-textMain font-black text-lg">{landlordName || 'Not Set'}</Text>
                  </View>
                  <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50 flex-row items-center justify-between">
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
            <View className="bg-surface rounded-3xl p-5 border border-border shadow-sm">
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
                  <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50"><Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Network</Text><Text className="text-textMain font-black text-lg">{wifiName || 'Not Set'}</Text></View>
                  <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50 flex-row items-center justify-between">
                    <View><Text className="text-textMuted text-[10px] font-bold uppercase mb-1">Password</Text><Text className="text-textMain font-black text-lg">{wifiPass || 'Not Set'}</Text></View>
                    <TouchableOpacity className="bg-slate-200 w-10 h-10 rounded-full items-center justify-center" onPress={() => copyToClipboard(wifiPass)}><MaterialIcons name="content-copy" size={18} color="#4B5563" /></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {(tab === 'all' || tab === 'trash') && (
            <View className="bg-surface rounded-3xl p-5 border border-border shadow-sm">
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
                <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50 flex-row items-baseline">
                  <Text className="text-3xl font-black text-textMain">{trashArrivalTime ? trashArrivalTime.split(':')[0] : '--'}</Text>
                  <Text className="text-xl font-black text-textMuted mx-1">:</Text>
                  <Text className="text-3xl font-black text-textMain">{trashArrivalTime ? trashArrivalTime.split(':')[1] : '--'}</Text>
                  <Text className="text-xs font-black text-textMuted ml-1 uppercase">{trashArrivalTime ? (parseInt(trashArrivalTime.split(':')[0]) >= 12 ? 'PM' : 'AM') : ''}</Text>
                </View>
              )}
              {showTimePicker && (
                <Modal visible={showTimePicker} transparent animationType="fade">
                  <TouchableOpacity className="flex-1 bg-black/40 justify-center items-center px-6" activeOpacity={1} onPress={() => setShowTimePicker(false)}>
                    <TouchableOpacity activeOpacity={1} className="w-full bg-surface rounded-[32px] p-6 shadow-2xl" onPress={(e) => e.stopPropagation()}>
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
            <View className="bg-surface rounded-3xl p-5 border border-border shadow-sm">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-slate-100 p-2 rounded-lg"><MaterialIcons name="description" size={20} color="#6B7280" /></View>
                <Text className="text-textMain font-bold">House Rules</Text>
              </View>
              {isEdit ? (
                <TextInput className="bg-background rounded-xl p-3 text-textMain font-medium border border-border/50 min-h-[100px]" placeholder="Rules..." multiline numberOfLines={4} textAlignVertical="top" value={otherInfo} onChangeText={setOtherInfo} />
              ) : (
                <View className="bg-surfaceRaised p-4 rounded-2xl border border-border/50 min-h-[60px]"><Text className="text-textMain font-medium leading-6">{otherInfo || 'None'}</Text></View>
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
