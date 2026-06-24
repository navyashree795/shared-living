import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  Alert, ScrollView, Switch, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeWheelPicker } from '../components/TimeWheelPicker';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { getSyncedDate, getNextOccurrence } from '../utils/timeUtils';
import { getCycleStartDate } from '../utils/retentionUtils';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useHousehold } from '../context/HouseholdContext';
import { Card } from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import SwipeableRow from '../components/SwipeableRow';
import { ChoreSkeleton } from '../components/Skeleton';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, arrayUnion, Timestamp, where
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { scheduleChoreReminder, cancelChoreReminder } from '../utils/notificationUtils';
import { Chore } from '../types';
type Props = { navigation: any; route?: any };

export default function ChoresScreen({ route, navigation }: Props) {
  const { householdId, householdData } = useHousehold();
  const { isDark } = useTheme();
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const { showToast } = useToast();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [choreTitle, setChoreTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>(auth.currentUser?.uid || '');
  const [time, setTime] = useState(getSyncedDate());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isRotationEnabled, setIsRotationEnabled] = useState(false);
  const [rotationOrder, setRotationOrder] = useState<string[]>([]);
  const { profile: userData } = useUser();
  const { members, getMemberName, memberProfiles } = useHousehold();
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recentlyNudged, setRecentlyNudged] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isModalVisible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [isModalVisible]);

  useEffect(() => {
    if (!householdId) return;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, 'households', householdId, 'chores'),
      where('createdAt', '>=', Timestamp.fromDate(mainStartDate)),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedChores = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chore));
      setChores(fetchedChores);
      setLoading(false);

      // Mark unread chores assigned to me as seen
      const myUid = auth.currentUser?.uid;
      if (myUid) {
        const unseenChores = fetchedChores.filter(c => 
          c.assignedToUid === myUid && (!c.seenBy || !c.seenBy.includes(myUid))
        );
        if (unseenChores.length > 0) {
          unseenChores.forEach(c => {
            updateDoc(doc(db, 'households', householdId, 'chores', c.id), {
              seenBy: arrayUnion(myUid)
            });
          });
        }
      }
    });
    return unsub;
  }, [householdId, householdData?.billingCycleStartDay]);

  const openEditModal = (chore: Chore) => {
    setEditingChore(chore);
    setChoreTitle(chore.title);
    setAssignedTo(chore.assignedToUid);
    setIsRotationEnabled(chore.rotationEnabled || false);
    setRotationOrder(chore.rotationOrder || []);
    
    // Robust parsing for "HH:MM AM/PM" or "HH:MM:SS"
    try {
      const timeMatch = chore.time.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3]?.toUpperCase();

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        
        // Final safety check
        if (isNaN(d.getTime())) throw new Error("Invalid time");
        setTime(d);
      } else {
        setTime(new Date());
      }
    } catch (e) {
      console.warn("Time parsing failed, defaulting to now:", e);
      setTime(new Date());
    }
    
    setIsModalVisible(true);
  };

  const handleAddChore = async () => {
    if (!choreTitle.trim()) { Alert.alert('Error', 'Please enter a chore name.'); return; }
    if (!householdId) return;
    if (isRotationEnabled && rotationOrder.length === 0) {
      Alert.alert('Error', 'Please select at least one person for the rotation.');
      return;
    }
    
    const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const currentUserName = userData?.username ? userData.username : (auth.currentUser?.email?.split('@')[0] || 'Member');
    
    try {
      const baseChoreData = {
        title: choreTitle.trim(),
        assignedToUid: assignedTo,
        time: formattedTime,
        rotationEnabled: isRotationEnabled,
        rotationOrder: isRotationEnabled ? rotationOrder : [],
      };

      if (editingChore) {
        if (editingChore.notificationId) {
          await cancelChoreReminder(editingChore.notificationId);
        }
        const nextTarget = getNextOccurrence(editingChore.day, formattedTime);
        const notifId = await scheduleChoreReminder(choreTitle.trim(), nextTarget);
        await updateDoc(doc(db, 'households', householdId, 'chores', editingChore.id), {
          ...baseChoreData,
          targetDate: Timestamp.fromDate(nextTarget),
          notificationId: notifId || null,
        });
        showToast('Chore Updated', 'success');
      } else {
        const fullChoreData = {
          ...baseChoreData,
          done: false,
          createdByUid: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          currentRotationIndex: 0,
          seenBy: [auth.currentUser?.uid],
        };

        if (selectedDays.length > 0) {
          await Promise.all(selectedDays.map(async (day) => {
            const nextTarget = getNextOccurrence(day, formattedTime);
            const notifId = await scheduleChoreReminder(choreTitle.trim(), nextTarget);
            return addDoc(collection(db, 'households', householdId, 'chores'), {
              ...fullChoreData,
              day: day,
              targetDate: Timestamp.fromDate(nextTarget),
              notificationId: notifId || null,
            });
          }));
          logActivity(householdId, 'chore_add', `${choreTitle.trim()} (${selectedDays.join(', ')})`, currentUserName);
          const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const today = daysOfWeek[getSyncedDate().getDay()];
          const nextTarget = getNextOccurrence(today, formattedTime);
          const notifId = await scheduleChoreReminder(choreTitle.trim(), nextTarget);
          await addDoc(collection(db, 'households', householdId, 'chores'), {
            ...fullChoreData,
            day: today,
            targetDate: Timestamp.fromDate(nextTarget),
            notificationId: notifId || null,
          });
          logActivity(householdId, 'chore_add', choreTitle.trim(), currentUserName);
        }
        showToast('Chore Added', 'success');
      }

      setChoreTitle(''); setAssignedTo(auth.currentUser?.uid || ''); setSelectedDays([]);
      setIsRotationEnabled(false); setRotationOrder([]); setEditingChore(null);
      setIsModalVisible(false);
    } catch (error: any) {
      console.error('Chore Save Error:', error);
      Alert.alert('Error', 'Could not save chore. ' + error.message);
    }
  };

  const handleToggleDone = useCallback(async (chore: Chore) => {
    if (!householdId) return;
    try {
      const isMarkingDone = !chore.done;
      
      if (isMarkingDone) {
        if (chore.notificationId) {
          await cancelChoreReminder(chore.notificationId);
        }
        await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
          done: true,
          notificationId: null,
        });
        showToast('Chore finished! 🎉', 'success');
        logActivity(householdId, 'chore_done', chore.title);

        if (chore.rotationEnabled && chore.rotationOrder && chore.rotationOrder.length > 0) {
          const nextIndex = ((chore.currentRotationIndex || 0) + 1) % chore.rotationOrder.length;
          const nextAssignee = chore.rotationOrder[nextIndex];
          
          const baseDate = chore.targetDate ? chore.targetDate.toDate() : getSyncedDate();
          const nextTargetDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          const nextNotifId = await scheduleChoreReminder(chore.title, nextTargetDate);

          await addDoc(collection(db, 'households', householdId, 'chores'), {
            title: chore.title,
            assignedToUid: nextAssignee,
            time: chore.time,
            day: chore.day,
            done: false,
            rotationEnabled: true,
            rotationOrder: chore.rotationOrder,
            currentRotationIndex: nextIndex,
            createdByUid: chore.createdByUid || auth.currentUser?.uid || '',
            createdAt: serverTimestamp(),
            seenBy: [nextAssignee],
            targetDate: Timestamp.fromDate(nextTargetDate),
            notificationId: nextNotifId || null,
          });

          showToast(`Rotated to ${getMemberName(nextAssignee)}`, 'info');
          logActivity(householdId, 'chore_rotate', chore.title, undefined, 0, nextAssignee);
        }
      } else {
        const nextOccurrence = getNextOccurrence(chore.day, chore.time);
        const notifId = await scheduleChoreReminder(chore.title, nextOccurrence);
        await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
          done: false,
          targetDate: Timestamp.fromDate(nextOccurrence),
          notificationId: notifId || null,
        });
        showToast('Chore reopened', 'info');
      }
    } catch (error) {
      console.error('Chore Toggle Error:', error);
      Alert.alert('Error', 'Could not update chore.');
    }
  }, [householdId, showToast, getMemberName]);

  const handleReminder = useCallback(async (chore: Chore) => {
    if (!householdId) return;
    try {
      logActivity(householdId, 'chore_reminder', chore.title, undefined, 0, chore.assignedToUid);
      
      // Visual feedback state
      setRecentlyNudged(prev => new Set(prev).add(chore.id));
      setTimeout(() => {
        setRecentlyNudged(prev => {
          const next = new Set(prev);
          next.delete(chore.id);
          return next;
        });
      }, 2000);

      showToast('Nudge sent!', 'success');
    } catch (error) {
      console.error('Chore Reminder Error:', error);
    }
  }, [householdId, showToast]);

  const handleDelete = useCallback(async (choreId: string) => {
    if (!householdId) return;
    Alert.alert('Delete Chore', 'Remove this chore?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const chore = chores.find(c => c.id === choreId);
          if (chore?.notificationId) {
            await cancelChoreReminder(chore.notificationId);
          }
          await deleteDoc(doc(db, 'households', householdId, 'chores', choreId));
          showToast('Chore Deleted', 'success');
        } catch {
          Alert.alert('Error', 'Could not delete chore.');
        }
      }}
    ]);
  }, [householdId, chores, showToast]);

  const pending = chores.filter(c => !c.done);
  const done = chores.filter(c => c.done);

  const renderChore = useCallback(({ item }: { item: Chore }) => {
    const isDone = item.done;
    const isExpanded = expandedId === item.id;

    return (
      <SwipeableRow
        onDelete={() => handleDelete(item.id)}
        onEdit={() => openEditModal(item)}
        onComplete={() => handleToggleDone(item)}
        isRotation={item.rotationEnabled}
      >
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          style={{ 
            backgroundColor: isDone ? (isDark ? 'rgba(255,255,255,0.02)' : '#F9FAFB') : surface, 
            borderRadius: 24, 
            padding: 16, 
            marginBottom: 12, 
            borderWidth: 1, 
            borderColor: isDone ? (isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB') : bord,
            overflow: 'hidden',
            elevation: isDone ? 0 : 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDone ? 0 : (isDark ? 0.2 : 0.05),
            shadowRadius: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Left Priority Indicator */}
            {!isDone && (
              <View style={{ 
                position: 'absolute', 
                left: -16, 
                top: -16, 
                bottom: -16, 
                width: 4, 
                backgroundColor: '#EF4444', 
                borderTopRightRadius: 4, 
                borderBottomRightRadius: 4 
              }} />
            )}

            {/* Status Circle */}
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                handleToggleDone(item);
              }}
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                borderWidth: isDone ? 0 : 1.5, 
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                backgroundColor: isDone ? '#10B981' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                marginLeft: 4,
                zIndex: 10
              }} 
            >
              {isDone && <MaterialIcons name="check" size={18} color="white" />}
            </TouchableOpacity>
            
            {/* Chore Info */}
            <View style={{ flex: 1 }}>
              <Text 
                numberOfLines={1}
                style={{ 
                  fontSize: 16, 
                  fontWeight: '700', 
                  color: isDone ? (isDark ? 'rgba(255,255,255,0.3)' : '#9CA3AF') : text, 
                  textDecorationLine: isDone ? 'line-through' : 'none',
                  marginBottom: 6 
                }}
              >
                {item.title}
              </Text>
              
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {/* Assignee Pill */}
                <View style={{ 
                  backgroundColor: isDark ? 'rgba(79, 70, 229, 0.15)' : '#EEF2FF', 
                  paddingHorizontal: 10, 
                  paddingVertical: 4, 
                  borderRadius: 12 
                }}>
                  <Text style={{ color: isDark ? '#818CF8' : '#4F46E5', fontSize: 11, fontWeight: '700' }}>
                    {getMemberName(item.assignedToUid).toLowerCase()}
                  </Text>
                </View>

                {/* Time Pill */}
                <View style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6', 
                  paddingHorizontal: 10, 
                  paddingVertical: 4, 
                  borderRadius: 12 
                }}>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#6B7280', fontSize: 11, fontWeight: '600' }}>
                    {item.time}
                  </Text>
                </View>

                {/* Day Pill */}
                {!!item.day && (
                  <View style={{ 
                    backgroundColor: isDone 
                      ? (isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB') 
                      : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'), 
                    paddingHorizontal: 10, 
                    paddingVertical: 4, 
                    borderRadius: 12 
                  }}>
                    <Text style={{ 
                      color: isDone 
                        ? (isDark ? 'rgba(255,255,255,0.2)' : '#D1D5DB') 
                        : (isDark ? '#F87171' : '#EF4444'), 
                      fontSize: 10, 
                      fontWeight: '900', 
                      textTransform: 'uppercase' 
                    }}>
                      {item.day}
                      {item.targetDate ? `, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][item.targetDate.toDate().getMonth()]} ${item.targetDate.toDate().getDate()}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <MaterialIcons 
              name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={20} 
              color={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} 
            />
          </View>

          {/* Expanded Details */}
          {isExpanded && (
            <View style={{ 
              marginTop: 16, 
              paddingTop: 16, 
              borderTopWidth: 1, 
              borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Rotation Status</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>
                    {item.rotationEnabled ? `Cycle: ${item.rotationOrder?.length} members` : 'Fixed assignment'}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {!isDone && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); handleReminder(item); }}
                      style={{ 
                        backgroundColor: recentlyNudged.has(item.id) ? 'rgba(245, 158, 11, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F9FAFB'), 
                        paddingHorizontal: 12, 
                        paddingVertical: 8, 
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: isDark ? 0 : 1,
                        borderColor: recentlyNudged.has(item.id) ? 'rgba(245, 158, 11, 0.3)' : '#F3F4F6'
                      }}
                    >
                      <MaterialIcons 
                        name={recentlyNudged.has(item.id) ? "notifications" : "notifications-none"} 
                        size={16} 
                        color={recentlyNudged.has(item.id) ? "#F59E0B" : (isDark ? "#A78BFA" : "#4F46E5")} 
                      />
                      <Text style={{ 
                        color: recentlyNudged.has(item.id) ? "#F59E0B" : (isDark ? "#A78BFA" : "#4F46E5"), 
                        fontSize: 11, 
                        fontWeight: '700', 
                        marginLeft: 6 
                      }}>
                        {recentlyNudged.has(item.id) ? "Sent!" : "Nudge"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Created By</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text }}>{getMemberName(item.createdByUid || '') || 'System'}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [getMemberName, handleToggleDone, handleDelete, handleReminder, surface, bord, text, muted, isDark, openEditModal, expandedId, recentlyNudged]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScreenHeader 
        navigation={navigation as any} 
        title="Chores" 
        rightIcon="add" 
        rightIconColor="#D97706"
        rightIconBg="bg-warning/10"
        rightIconBorder="border-warning/30"
        onRightPress={() => setIsModalVisible(true)} 
      />

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 16 }}>
        <View style={{ 
          flex: 1, 
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', 
          borderRadius: 20, 
          padding: 16, 
          alignItems: 'center', 
          borderWidth: 1, 
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 5,
          elevation: 2
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: text }}>{pending.length}</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', marginTop: 2, textTransform: 'uppercase' }}>Pending</Text>
        </View>
        <View style={{ 
          flex: 1, 
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5', 
          borderRadius: 20, 
          padding: 16, 
          alignItems: 'center', 
          borderWidth: 1, 
          borderColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
          shadowColor: '#10B981',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 5,
          elevation: 2
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#10B981' }}>{done.length}</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? 'rgba(16, 185, 129, 0.5)' : '#059669', marginTop: 2, textTransform: 'uppercase' }}>Done</Text>
        </View>
        <View style={{ 
          flex: 1, 
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', 
          borderRadius: 20, 
          padding: 16, 
          alignItems: 'center', 
          borderWidth: 1, 
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 5,
          elevation: 2
        }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: text }}>{chores.length}</Text>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', marginTop: 2, textTransform: 'uppercase' }}>Total</Text>
        </View>
      </View>

      {/* Weekly Progress Card */}
      <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
        <View style={{ 
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', 
          borderRadius: 28, 
          padding: 20, 
          borderWidth: 1, 
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.2 : 0.08,
          shadowRadius: 20,
          elevation: 5
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>Weekly Progress</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={{ color: text, fontSize: 32, fontWeight: '900' }}>{chores.length > 0 ? Math.round((done.length / chores.length) * 100) : 0}</Text>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', fontSize: 18, fontWeight: '700', marginLeft: 2 }}>%</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 4 }}>
                 <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>TARGET: 100%</Text>
              </View>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', fontSize: 11, fontWeight: '600' }}>{done.length} of {chores.length} chores done</Text>
            </View>
          </View>
          
          <View style={{ height: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
            <View style={{ 
              height: '100%', 
              width: `${chores.length > 0 ? (done.length / chores.length) * 100 : 0}%`, 
              backgroundColor: '#10B981', 
              borderRadius: 5,
            }} />
          </View>
        </View>
      </View>

      {loading ? (
        <View className="px-6">
          {[1, 2, 3, 4, 5].map((i) => <ChoreSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={[...pending, ...done]}
          extraData={memberProfiles}
          keyExtractor={i => i.id}
          renderItem={renderChore}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          ListHeaderComponent={
            chores.length > 0 ? (
              <Text style={{ 
                color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)', 
                fontSize: 10, 
                fontWeight: '900', 
                letterSpacing: 1.5, 
                marginBottom: 16, 
                marginLeft: 4, 
                textTransform: 'uppercase' 
              }}>
                Household Tasks
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState 
              icon="cleaning-services" 
              title="No chores assigned" 
              description="Your home is spotless! Tap the + button to assign new tasks."
            />
          }
        />
      )}

      <SlideModal
        visible={isModalVisible}
        onClose={() => { setIsModalVisible(false); setEditingChore(null); setChoreTitle(''); }}
        title={editingChore ? "Edit Chore" : "Add Chore"}
      >
        <View className="pt-1 pb-1">
          {!showSplitOptions ? (
            <View>
              <View className="border-b border-border/60 pb-1.5 mb-4">
                <Text className="text-textMuted text-[9px] font-bold uppercase tracking-widest mb-1">What needs to be done?</Text>
                <TextInput 
                  ref={inputRef}
                  className="text-textMain text-base font-bold" 
                  placeholder="e.g. Sweep the floor" 
                  placeholderTextColor="#D1D5DB"
                  value={choreTitle} 
                  onChangeText={setChoreTitle} 
                />
              </View>

              <View className="mb-4">
                <Text className="text-textMuted text-xs font-bold mb-2">Select Days</Text>
                <View className="flex-row justify-between">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
                    const isSelected = selectedDays.includes(d);
                    return (
                      <TouchableOpacity 
                        key={d} 
                        onPress={() => {
                          if (isSelected) {
                            setSelectedDays(selectedDays.filter(day => day !== d));
                          } else {
                            setSelectedDays([...selectedDays, d]);
                          }
                        }}
                        className={`w-8.5 h-8.5 rounded-full items-center justify-center border ${isSelected ? 'bg-warning border-warning' : 'bg-surfaceRaised border-border'}`}
                      >
                        <Text className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="border-b border-border/60 pb-1.5 mb-4 flex-row justify-between items-center">
                <Text className="text-textMuted text-xs font-bold w-16">Time</Text>
                <TouchableOpacity 
                  onPress={() => setShowTimePicker(true)}
                  className={`flex-row items-baseline rounded-xl px-3 py-0.5 ${showTimePicker ? 'bg-primary/5' : ''}`}
                >
                  <Text className="text-lg font-black text-textMain">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]}</Text>
                  <Text className="text-sm font-black text-textMuted mx-0.5">:</Text>
                  <Text className="text-lg font-black text-textMain">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]}</Text>
                  <Text className="text-[9px] font-black text-textMuted ml-1 uppercase">{time.getHours() >= 12 ? 'PM' : 'AM'}</Text>
                </TouchableOpacity>
              </View>



              <View className="flex-row items-center justify-between mb-4 bg-surfaceRaised p-3 rounded-2xl border border-border/50">
                <View className="flex-1">
                  <Text className="text-textMain font-bold text-sm">Automated Rotation</Text>
                  <Text className="text-textMuted text-[10px]">Rotates between members automatically</Text>
                </View>
                <Switch 
                  value={isRotationEnabled}
                  onValueChange={(val) => {
                    setIsRotationEnabled(val);
                    if (val && (rotationOrder.length <= 1)) {
                      setRotationOrder(members || []);
                      if (members && members.length > 0) setAssignedTo(members[0]);
                    }
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#F59E0B' }}
                  thumbColor="#FFF"
                />
              </View>

              <TouchableOpacity 
                onPress={() => setShowSplitOptions(true)}
                className="bg-secondary/30 rounded-xl py-2.5 px-4 items-center flex-row border border-border/50 mb-4"
              >
                <MaterialIcons name="people" size={18} color="#4F46E5" />
                <Text className="text-textMain font-bold text-sm ml-3 flex-1">
                  {isRotationEnabled 
                    ? `Rotation: ${rotationOrder.length} Members`
                    : `Assignee: ${assignedTo ? getMemberName(assignedTo) : 'Select Person'}`
                  }
                </Text>
                <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <View className="flex-row justify-between mt-1">
                <TouchableOpacity 
                  className="flex-1 bg-background py-2.5 rounded-xl items-center mr-3 border border-border/40"
                  onPress={() => { setIsModalVisible(false); setShowSplitOptions(false); setChoreTitle(''); }}
                >
                  <Text className="text-textMuted font-bold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 bg-textMain py-2.5 rounded-xl items-center" 
                  onPress={handleAddChore}
                >
                  <Text className="text-white font-bold text-sm">Save</Text>
                </TouchableOpacity>
              </View>

            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-textMain text-base font-black">Assign to</Text>
                  {isRotationEnabled && (
                    <TouchableOpacity onPress={() => setRotationOrder(members || [])}>
                      <Text className="text-primary text-[9px] font-black uppercase mt-0.5">Select All Members</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => setShowSplitOptions(false)} className="bg-primary/10 px-3 py-1 rounded-full">
                   <Text className="text-primary font-bold text-[10px] uppercase">Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ maxHeight: 280 }}>
                {(members || []).map(uid => {
                  const isInRotation = rotationOrder.includes(uid);
                  const isPrimaryAssignee = assignedTo === uid;
                  const isSelected = isRotationEnabled ? isInRotation : isPrimaryAssignee;

                  return (
                    <TouchableOpacity 
                      key={uid} 
                      className={`flex-row items-center p-2.5 rounded-xl mb-1.5 border ${isSelected ? 'bg-warning/10 border-warning/30' : 'bg-background border-border'} `}
                      onPress={() => {
                        if (isRotationEnabled) {
                          if (isInRotation) {
                            const newOrder = rotationOrder.filter(id => id !== uid);
                            setRotationOrder(newOrder);
                            // If we removed the current assignee, pick the next available or first
                            if (isPrimaryAssignee) setAssignedTo(newOrder[0] || '');
                          } else {
                            const newOrder = [...rotationOrder, uid];
                            setRotationOrder(newOrder);
                            if (!assignedTo) setAssignedTo(uid);
                          }
                        } else {
                          setAssignedTo(uid);
                        }
                      }}
                    >
                      <View className="flex-row items-center flex-1">
                        <MaterialIcons
                          name={isSelected ? (isRotationEnabled ? 'check-box' : 'radio-button-checked') : (isRotationEnabled ? 'check-box-outline-blank' : 'radio-button-unchecked')}
                          size={24} 
                          color={isSelected ? '#D97706' : '#9CA3AF'}
                        />
                        <Text className={`text-base font-bold ml-3 ${isSelected ? 'text-warning' : 'text-textMuted'}`}>
                          {getMemberName(uid)}
                        </Text>
                      </View>
                      {isRotationEnabled && isInRotation && (
                        <View className="bg-warning w-6 h-6 rounded-full items-center justify-center">
                          <Text className="text-white text-[10px] font-black">{rotationOrder.indexOf(uid) + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </SlideModal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/40 justify-center items-center px-6"
          activeOpacity={1}
          onPress={() => setShowTimePicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            style={{ width: '92%', maxWidth: 350 }}
            onPress={(e) => e.stopPropagation()}
          >
            <TimeWheelPicker 
              initialTime={time}
              onConfirm={(date) => { setTime(date); setShowTimePicker(false); }}
              onCancel={() => setShowTimePicker(false)}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
