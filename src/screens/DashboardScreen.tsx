import React, { useState, useEffect, memo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, TextInput, Image, Linking } from 'react-native';
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
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
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
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  const toggleFieldVisibility = (id: string) => {
    setRevealedFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

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
    ? ['#070913', '#0F1324'] as readonly [string, string]
    : ['#F5F7FF', '#EBEFFF'] as readonly [string, string];
  const textMain = isDark ? '#F1F5F9' : '#1E1B4B';
  const textMuted = isDark ? '#A78BFA' : '#4F46E5';
  const glassBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const glassBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.85)';
  const blurTint = isDark ? 'dark' : 'light';

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

  const detailsList = householdData?.info?.details || [
    { id: 'wifi_net', label: 'WiFi Network', value: householdData?.info?.wifiName || '', type: 'text', icon: 'wifi' },
    { id: 'wifi_pass', label: 'WiFi Password', value: householdData?.info?.wifiPass || '', type: 'password', icon: 'vpn-key' },
    { id: 'landlord', label: 'Landlord', value: householdData?.info?.landlordName || '', type: 'text', icon: 'phone-in-talk' },
    { id: 'trash_truck', label: 'Trash Truck', value: householdData?.info?.trashArrivalTime || '', type: 'time', icon: 'delete-outline' }
  ].filter(item => item.value);

  const handlePhoneCall = async (phone: string) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Clipboard.setStringAsync(phone);
        showToast('Phone copied to clipboard', 'success');
      }
    } catch {
      await Clipboard.setStringAsync(phone);
      showToast('Phone copied to clipboard', 'success');
    }
  };

  const handleOpenLink = async (link: string) => {
    if (!link) return;
    let formatted = link.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    try {
      const supported = await Linking.canOpenURL(formatted);
      if (supported) {
        await Linking.openURL(formatted);
      } else {
        await Clipboard.setStringAsync(link);
        showToast('Link copied to clipboard', 'success');
      }
    } catch {
      await Clipboard.setStringAsync(link);
      showToast('Link copied to clipboard', 'success');
    }
  };

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      {/* Glowing Ambient Backdrops */}
      <View style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: isDark ? 'rgba(124, 58, 237, 0.18)' : 'rgba(99, 102, 241, 0.08)', zIndex: 0 }} />
      <View style={{ position: 'absolute', top: 380, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)', zIndex: 0 }} />

      <SafeAreaView style={{ flex: 1, zIndex: 1 }} edges={['top']}>
        {/* Sleek Premium Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ position: 'relative' }}>
              <View style={{ padding: 2.5, borderRadius: 24, borderWidth: 1.5, borderColor: isDark ? '#A78BFA' : '#4F46E5', backgroundColor: 'transparent' }}>
                <Avatar name={userData?.username || 'U'} size={38} bgColor={isDark ? '#1E1B4B' : '#EEF2FF'} color={isDark ? '#A78BFA' : '#4F46E5'} style={{ borderRadius: 19 }} />
              </View>
              <View style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: isDark ? '#070913' : '#F5F7FF' }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSwitchModalVisible(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Household Hub</Text>
                <MaterialIcons name="keyboard-arrow-down" size={13} color={textMuted} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: textMain, letterSpacing: -0.6 }}>{householdData?.name || 'Loading...'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setIsMembersModalVisible(true)}>
              <BlurView intensity={25} tint={blurTint} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                <MaterialIcons name="people" size={20} color={isDark ? '#C084FC' : '#4F46E5'} />
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}}>
              <BlurView intensity={25} tint={blurTint} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                <MaterialIcons name="notifications" size={20} color={isDark ? '#C084FC' : '#4F46E5'} />
                <View style={{ position: 'absolute', top: 10, right: 11, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', borderWidth: 1, borderColor: isDark ? '#070913' : '#FFFFFF' }} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Horizontal Activity Stream */}
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {loadingActivities ? (
                [1, 2, 3].map(i => (
                  <BlurView key={i} intensity={15} tint={blurTint} style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 140, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                    <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: glassBg }} />
                    <View>
                      <View style={{ width: 60, height: 8, borderRadius: 3, backgroundColor: glassBg, marginBottom: 4 }} />
                      <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: glassBg }} />
                    </View>
                  </BlurView>
                ))
              ) : activities.length > 0 ? (
                activities.slice(0, 6).map((activity, idx) => {
                  const config = getActivityConfig(activity.type);
                  return (
                    <BlurView key={activity.id || idx} intensity={20} tint={blurTint} style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                      <View style={{ backgroundColor: isDark ? 'rgba(192, 132, 252, 0.15)' : 'rgba(99, 102, 241, 0.08)', padding: 6, borderRadius: 8 }}>
                        <MaterialIcons name={config.icon} size={14} color={isDark ? '#C084FC' : '#4F46E5'} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: textMain }} numberOfLines={1}>{activity.userName} {config.label.toLowerCase()}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>{activity.createdAt?.toDate ? activity.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Just now'}</Text>
                      </View>
                    </BlurView>
                  );
                })
              ) : (
                <BlurView intensity={20} tint={blurTint} style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#A78BFA' : '#4F46E5' }}>✨ All caught up! No recent activity.</Text>
                </BlurView>
              )}
            </ScrollView>
          </View>

          {/* Futuristic Glassy Household Hub Card */}
          <View style={{ paddingHorizontal: 16, marginBottom: 18 }}>
            <BlurView intensity={25} tint={blurTint} style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.1)' }}>
              <LinearGradient colors={isDark ? ['rgba(14, 19, 36, 0.9)', 'rgba(7, 9, 19, 0.95)'] : ['rgba(255, 255, 255, 0.95)', 'rgba(240, 244, 255, 0.95)']} style={{ padding: 16 }}>
                {/* Hub Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: isDark ? '#A78BFA' : '#4F46E5' }} />
                    <Text style={{ fontSize: 12, fontWeight: '900', color: textMain, textTransform: 'uppercase', letterSpacing: 1 }}>Household Details</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setInfoModalTab('all'); setIsEditMode(true); setIsInfoModalVisible(true); }} style={{ padding: 6, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                    <MaterialIcons name="edit" size={16} color={isDark ? '#C084FC' : '#4F46E5'} />
                  </TouchableOpacity>
                </View>

                {/* Info Grid (Fixed-height Scrollable Widget) */}
                <View style={{ height: 140 }}>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {detailsList.length > 0 ? (
                      detailsList.map((field: any) => {
                        const isTrashAndHasCountdown = field.type === 'time' && field.icon === 'delete-outline' && trashCountdown;
                        return (
                          <View key={field.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: isTrashAndHasCountdown ? 'rgba(245, 158, 11, 0.2)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                              <View style={{ backgroundColor: isTrashAndHasCountdown ? 'rgba(245, 158, 11, 0.18)' : (isDark ? 'rgba(192, 132, 252, 0.15)' : 'rgba(99, 102, 241, 0.08)'), padding: 8, borderRadius: 12 }}>
                                <MaterialIcons name={field.icon || 'description'} size={18} color={isTrashAndHasCountdown ? '#FBBF24' : (isDark ? '#C084FC' : '#4F46E5')} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 9, color: isTrashAndHasCountdown ? '#FBBF24' : (isDark ? '#94A3B8' : '#64748B'), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{isTrashAndHasCountdown ? 'Truck Arriving' : field.label}</Text>
                                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: isTrashAndHasCountdown ? '#FBBF24' : textMain }}>
                                  {isTrashAndHasCountdown 
                                    ? `${trashCountdown}` 
                                    : (field.type === 'password' && field.value 
                                        ? (revealedFields.includes(field.id) ? field.value : '••••••••') 
                                        : (field.value || 'Not Set'))}
                                </Text>
                              </View>
                            </View>
                            
                            {field.type === 'password' && field.value ? (
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity onPress={() => toggleFieldVisibility(field.id)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                                  <MaterialIcons name={revealedFields.includes(field.id) ? "visibility" : "visibility-off"} size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(field.value); showToast('Copied to clipboard', 'success'); }} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                                  <MaterialIcons name="content-copy" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                                </TouchableOpacity>
                              </View>
                            ) : null}
                            {field.type === 'phone' && field.value ? (
                              <TouchableOpacity onPress={() => handlePhoneCall(field.value)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                                <MaterialIcons name="call" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                              </TouchableOpacity>
                            ) : null}
                            {field.type === 'link' && field.value ? (
                              <TouchableOpacity onPress={() => handleOpenLink(field.value)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                                <MaterialIcons name="link" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })
                    ) : (
                      <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B' }}>No details set yet. Tap Edit to add!</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </LinearGradient>
            </BlurView>
          </View>

          {/* Interactive Navigation Grid */}
          <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            {/* Grocery */}
            <TouchableOpacity onPress={() => handleNav('Grocery')} style={{ width: '48%', aspectRatio: 1.05 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: groceryBorder }}>
                <LinearGradient colors={groceryGrad} style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: 2 }}>Grocery</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>View shared list →</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: 7, borderRadius: 10 }}>
                      <MaterialIcons name="shopping-cart" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="shopping-cart" size={54} color="rgba(255, 255, 255, 0.12)" style={{ position: 'absolute', bottom: -6, right: -6 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Expenses */}
            <TouchableOpacity onPress={() => handleNav('Expenses')} style={{ width: '48%', aspectRatio: 1.05 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: expenseBorder }}>
                <LinearGradient colors={expenseGrad} style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: 2 }}>Expenses</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>Split bills easily →</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: 7, borderRadius: 10 }}>
                      <MaterialIcons name="attach-money" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="bar-chart" size={54} color="rgba(255, 255, 255, 0.12)" style={{ position: 'absolute', bottom: -6, right: -6 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Chores */}
            <TouchableOpacity onPress={() => handleNav('Chores')} style={{ width: '48%', aspectRatio: 1.05 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: choresBorder }}>
                <LinearGradient colors={choresGrad} style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: 2 }}>Chores</Text>
                      <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>
                        {chores.filter(c => !c.done).length > 0 
                          ? `${chores.filter(c => !c.done).length} active tasks` 
                          : "All tasks done ✨"}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: 7, borderRadius: 10 }}>
                      <MaterialIcons name="cleaning-services" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="format-list-bulleted" size={54} color="rgba(255, 255, 255, 0.12)" style={{ position: 'absolute', bottom: -6, right: -6 }} />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>

            {/* Chat */}
            <TouchableOpacity onPress={() => handleNav('Chat')} style={{ width: '48%', aspectRatio: 1.05 }}>
              <BlurView intensity={cardIntensity} tint="light" style={{ flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: chatBorder }}>
                <LinearGradient colors={chatGrad} style={{ flex: 1, padding: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginBottom: 2 }}>Chat</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' }}>
                        {hasUnreadMessages ? "New messages 💬" : "Join chat →"}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', padding: 7, borderRadius: 10 }}>
                      <MaterialIcons name="chat" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                  <MaterialIcons name="chat" size={54} color="rgba(255, 255, 255, 0.12)" style={{ position: 'absolute', bottom: -6, right: -6 }} />
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
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(householdName || '');
  const [fields, setFields] = useState<any[]>(() => {
    if (data?.details && data.details.length > 0) return data.details;
    const initial = [];
    if (data?.wifiName) initial.push({ id: 'wifi_net', label: 'WiFi Network', value: data.wifiName, type: 'text', icon: 'wifi' });
    if (data?.wifiPass) initial.push({ id: 'wifi_pass', label: 'WiFi Password', value: data.wifiPass, type: 'password', icon: 'vpn-key' });
    if (data?.landlordName) initial.push({ id: 'landlord_contact', label: 'Landlord', value: data.landlordName, type: 'text', icon: 'phone-in-talk' });
    if (data?.trashArrivalTime) initial.push({ id: 'trash_truck', label: 'Trash Truck', value: data.trashArrivalTime, type: 'time', icon: 'delete-outline' });
    return initial;
  });

  const [activeTimePickerId, setActiveTimePickerId] = useState<string | null>(null);
  const [revealedFields, setRevealedFields] = useState<string[]>([]);

  const toggleFieldVisibility = (id: string) => {
    setRevealedFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleSave = () => {
    const updates: any = { details: fields };
    
    // Fallback static values for backwards compatibility
    const wifiF = fields.find(f => f.id === 'wifi_net' || f.label.toLowerCase().includes('network') || f.label.toLowerCase().includes('wifi name'));
    const passF = fields.find(f => f.id === 'wifi_pass' || f.label.toLowerCase().includes('password') || f.label.toLowerCase().includes('wifi pass'));
    const landF = fields.find(f => f.id === 'landlord_contact' || f.label.toLowerCase().includes('landlord'));
    const trashF = fields.find(f => f.type === 'time' && f.icon === 'delete-outline');

    updates.wifiName = wifiF ? wifiF.value : '';
    updates.wifiPass = passF ? passF.value : '';
    updates.landlordName = landF ? landF.value : '';
    updates.trashArrivalTime = trashF ? trashF.value : '';

    onSave({ name: name.trim() || 'My Household', info: updates });
  };

  const handleAddField = () => {
    setFields(prev => [...prev, { id: Math.random().toString(), label: '', value: '', type: 'text', icon: 'description' }]);
  };

  const handleDeleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: any) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast('Copied to clipboard', 'success');
  };

  const handlePhoneCall = async (phone: string) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Clipboard.setStringAsync(phone);
        showToast('Phone copied to clipboard', 'success');
      }
    } catch {
      await Clipboard.setStringAsync(phone);
      showToast('Phone copied to clipboard', 'success');
    }
  };

  const handleOpenLink = async (link: string) => {
    if (!link) return;
    let formatted = link.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    try {
      const supported = await Linking.canOpenURL(formatted);
      if (supported) {
        await Linking.openURL(formatted);
      } else {
        await Clipboard.setStringAsync(link);
        showToast('Link copied to clipboard', 'success');
      }
    } catch {
      await Clipboard.setStringAsync(link);
      showToast('Link copied to clipboard', 'success');
    }
  };

  const textMain = isDark ? '#F1F5F9' : '#1E1B4B';

  if (isEdit) {
    return (
      <>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ gap: 16, paddingBottom: 24 }}>
            {/* Household Name */}
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#A78BFA' : '#4F46E5', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Household Name</Text>
              <TextInput style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F1F5F9' : '#1E1B4B', backgroundColor: isDark ? '#070913' : '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} placeholder="e.g. My Flat" value={name} onChangeText={setName} />
            </View>

            {/* Dynamic Fields List */}
            <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginLeft: 4 }}>Custom Fields</Text>
            
            {fields.map((field) => (
              <View key={field.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 14, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', gap: 10 }}>
                {/* Inputs Row */}
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TextInput 
                    style={{ flex: 1, fontSize: 13, fontWeight: '800', color: isDark ? '#F1F5F9' : '#1E1B4B', backgroundColor: isDark ? '#070913' : '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} 
                    placeholder="Label (e.g. WiFi Network)" 
                    value={field.label} 
                    onChangeText={(v) => handleUpdateField(field.id, { label: v })} 
                  />
                  {field.type === 'time' ? (
                    <TouchableOpacity 
                      onPress={() => setActiveTimePickerId(field.id)} 
                      style={{ flex: 1.2, height: 42, backgroundColor: isDark ? '#070913' : '#FFFFFF', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: field.value ? (isDark ? '#FBBF24' : '#D97706') : '#94A3B8' }}>
                        {field.value || 'Set Time'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TextInput 
                      style={{ flex: 1.2, fontSize: 13, fontWeight: '700', color: isDark ? '#FBBF24' : '#1E1B4B', backgroundColor: isDark ? '#070913' : '#FFFFFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} 
                      placeholder="Value" 
                      value={field.value} 
                      onChangeText={(v) => handleUpdateField(field.id, { value: v })} 
                    />
                  )}
                  <TouchableOpacity onPress={() => handleDeleteField(field.id)} style={{ padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)', borderRadius: 10 }}>
                    <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Type Selection pills */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    { type: 'text', label: 'Text', icon: 'description' },
                    { type: 'password', label: 'Password', icon: 'vpn-key' },
                    { type: 'time', label: 'Time', icon: 'delete-outline' },
                    { type: 'phone', label: 'Phone', icon: 'call' },
                    { type: 'link', label: 'Link', icon: 'link' }
                  ].map((t) => (
                    <TouchableOpacity 
                      key={t.type} 
                      onPress={() => {
                        handleUpdateField(field.id, { type: t.type, icon: t.icon });
                        if (t.type === 'time') setActiveTimePickerId(field.id);
                      }}
                      style={{ 
                        paddingHorizontal: 10, 
                        paddingVertical: 5, 
                        borderRadius: 8, 
                        backgroundColor: field.type === t.type 
                          ? (isDark ? 'rgba(192, 132, 252, 0.22)' : 'rgba(99, 102, 241, 0.12)') 
                          : 'transparent',
                        borderWidth: 1,
                        borderColor: field.type === t.type 
                          ? (isDark ? '#C084FC' : '#4F46E5') 
                          : 'transparent'
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: field.type === t.type ? (isDark ? '#C084FC' : '#4F46E5') : (isDark ? '#94A3B8' : '#64748B') }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Nested TimePicker Modal */}
                {activeTimePickerId === field.id && (
                  <Modal visible={activeTimePickerId === field.id} transparent animationType="fade">
                    <TouchableOpacity className="flex-1 bg-black/40 justify-center items-center px-6" activeOpacity={1} onPress={() => setActiveTimePickerId(null)}>
                      <TouchableOpacity activeOpacity={1} className="w-full bg-surface rounded-[32px] p-6 shadow-2xl" onPress={(e) => e.stopPropagation()}>
                        <TimeWheelPicker 
                          initialTime={(() => { 
                            if (!field.value || typeof field.value !== 'string' || !field.value.includes(':')) return getSyncedDate(); 
                            const parts = field.value.split(':').map(Number);
                            const h = parts[0];
                            const m = parts[1];
                            if (isNaN(h) || isNaN(m)) return getSyncedDate();
                            const d = getSyncedDate(); 
                            d.setHours(h, m, 0, 0); 
                            return d; 
                          })()}
                          onConfirm={(date) => { const hours = date.getHours().toString().padStart(2, '0'); const minutes = date.getMinutes().toString().padStart(2, '0'); handleUpdateField(field.id, { value: `${hours}:${minutes}` }); setActiveTimePickerId(null); }}
                          onCancel={() => setActiveTimePickerId(null)}
                        />
                        <TouchableOpacity onPress={() => setActiveTimePickerId(null)} className="mt-4 py-3 items-center"><Text className="text-textMuted font-bold text-sm">Cancel</Text></TouchableOpacity>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </Modal>
                )}
              </View>
            ))}

            {/* Add Field Button */}
            <TouchableOpacity onPress={handleAddField} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: isDark ? 'rgba(192, 132, 252, 0.12)' : 'rgba(99, 102, 241, 0.06)', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: isDark ? '#C084FC' : '#4F46E5', marginTop: 6 }}>
              <MaterialIcons name="add" size={18} color={isDark ? '#C084FC' : '#4F46E5'} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#C084FC' : '#4F46E5' }}>Add Custom Field</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity onPress={handleSave} className="bg-indigo-600 rounded-2xl py-4 items-center shadow-lg shadow-indigo-300 mb-8">
          <Text className="text-white font-black text-lg">Save Changes</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ gap: 12, paddingBottom: 24 }}>
          {fields.length > 0 ? (
            fields.map((field) => (
              <View key={field.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  <View style={{ backgroundColor: isDark ? 'rgba(192, 132, 252, 0.15)' : 'rgba(99, 102, 241, 0.08)', padding: 8, borderRadius: 12 }}>
                    <MaterialIcons name={field.icon || 'description'} size={18} color={isDark ? '#C084FC' : '#4F46E5'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, color: isDark ? '#94A3B8' : '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{field.label}</Text>
                    <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '800', color: textMain }}>
                      {field.type === 'password' && field.value 
                        ? (revealedFields.includes(field.id) ? field.value : '••••••••') 
                        : (field.value || 'Not Set')}
                    </Text>
                  </View>
                </View>
                
                {/* Actions Based on Type */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {field.type === 'password' && field.value ? (
                    <>
                      <TouchableOpacity onPress={() => toggleFieldVisibility(field.id)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                        <MaterialIcons name={revealedFields.includes(field.id) ? "visibility" : "visibility-off"} size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => copyToClipboard(field.value)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                        <MaterialIcons name="content-copy" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {field.type === 'phone' && field.value ? (
                    <TouchableOpacity onPress={() => handlePhoneCall(field.value)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                      <MaterialIcons name="call" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                    </TouchableOpacity>
                  ) : null}
                  {field.type === 'link' && field.value ? (
                    <TouchableOpacity onPress={() => handleOpenLink(field.value)} style={{ padding: 7, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 10 }}>
                      <MaterialIcons name="link" size={14} color={isDark ? '#A78BFA' : '#4F46E5'} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B' }}>No custom fields added yet. Tap Edit to begin!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
});
HouseholdInfoModalContent.displayName = 'HouseholdInfoModalContent';
