import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  Alert, ScrollView, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeWheelPicker } from '../components/TimeWheelPicker';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { getSyncedDate } from '../utils/timeUtils';
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
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { Chore } from '../types';
type Props = { navigation: any; route?: any };

export default function ChoresScreen({ route, navigation }: Props) {
  const { householdId } = useHousehold();
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
    const q = query(
      collection(db, 'households', householdId, 'chores'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chore)));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const handleAddChore = async () => {
    if (!choreTitle.trim()) { Alert.alert('Error', 'Please enter a chore name.'); return; }
    if (!householdId) return;
    
    const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const currentUserName = userData?.username ? `@${userData.username}` : (auth.currentUser?.email?.split('@')[0] || 'Member');
    
    try {
      const baseChoreData = {
        title: choreTitle.trim(),
        assignedToUid: assignedTo,
        done: false,
        createdByUid: auth.currentUser?.uid,
        time: formattedTime,
        createdAt: serverTimestamp(),
        rotationEnabled: isRotationEnabled,
        rotationOrder: isRotationEnabled ? rotationOrder : [],
        currentRotationIndex: 0,
      };

      if (selectedDays.length > 0) {
        // Create SEPARATE chore for each selected day
        await Promise.all(selectedDays.map(day => 
          addDoc(collection(db, 'households', householdId, 'chores'), {
            ...baseChoreData,
            day: day,
          })
        ));
        logActivity(householdId, 'chore_add', `${choreTitle.trim()} (${selectedDays.join(', ')})`, currentUserName);
      } else {
        // Just create one for today if no days selected
        const today = getSyncedDate().toLocaleDateString('en-US', { weekday: 'short' });
        await addDoc(collection(db, 'households', householdId, 'chores'), {
          ...baseChoreData,
          day: today,
        });
        logActivity(householdId, 'chore_add', choreTitle.trim(), currentUserName);
      }

      setChoreTitle(''); setAssignedTo(auth.currentUser?.uid || ''); setSelectedDays([]);
      setIsRotationEnabled(false); setRotationOrder([]);
      setIsModalVisible(false);
      showToast('Chore Added', 'success');
    } catch (error: any) {
      console.error('Chore Add Error:', error);
      Alert.alert('Error', 'Could not add chore. ' + error.message);
    }
  };

  const handleToggleDone = useCallback(async (chore: Chore) => {
    if (!householdId) return;
    try {
      const isFinishing = !chore.done;
      
      if (isFinishing && chore.rotationEnabled && chore.rotationOrder && chore.rotationOrder.length > 0) {
        // CIRCULAR QUEUE LOGIC: Move to next person
        const nextIndex = ((chore.currentRotationIndex || 0) + 1) % chore.rotationOrder.length;
        const nextAssignee = chore.rotationOrder[nextIndex];
        
        await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
          done: false, // Reset to not done for the next person
          assignedToUid: nextAssignee,
          currentRotationIndex: nextIndex,
        });

        showToast(`Chore rotated to ${getMemberName(nextAssignee)}`, 'info');
        
        logActivity(householdId, 'chore_done', `${chore.title} (Rotated to ${getMemberName(nextAssignee)})`);
        
        // Notify the next person in chat
        await addDoc(collection(db, 'households', householdId, 'messages'), {
          text: `🔄 ${chore.title} is done! It's now @${getMemberName(nextAssignee)}'s turn.`,
          senderId: 'system',
          senderName: 'Chore Bot',
          createdAt: serverTimestamp(),
        });

      } else {
        await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
          done: isFinishing,
        });
        
        if (isFinishing) {
          showToast('Chore finished!', 'success');
          logActivity(householdId, 'chore_done', chore.title);
        }
      }
    } catch (error) {
      console.error('Chore Toggle Error:', error);
      Alert.alert('Error', 'Could not update chore.');
    }
  }, [householdId, getMemberName, showToast]);

  const handleReminder = useCallback(async (chore: Chore) => {
    if (!householdId) return;
    try {
      const assigneeName = getMemberName(chore.assignedToUid);
      const nudgerName = userData?.username || 'Roommate';

      await addDoc(collection(db, 'households', householdId, 'messages'), {
        text: `🔔 ${assigneeName}, don't forget to ${chore.title}! (From ${nudgerName})`,
        senderId: 'system',
        senderName: 'Reminder Bot',
        createdAt: serverTimestamp(),
      });

      showToast('Reminder Sent!', 'success');
      logActivity(householdId, 'chore_reminder', `${chore.title} -> ${assigneeName}`);
    } catch (error) {
      console.error('Reminder Error:', error);
      Alert.alert('Error', 'Failed to send reminder.');
    }
  }, [getMemberName, userData?.username, householdId, showToast]);

  const handleDelete = useCallback(async (choreId: string) => {
    if (!householdId) return;
    Alert.alert('Delete Chore', 'Remove this chore?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'households', householdId, 'chores', choreId));
          showToast('Chore Deleted', 'success');
        } catch {
          Alert.alert('Error', 'Could not delete chore.');
        }
      }}
    ]);
  }, [householdId, showToast]);

  const pending = chores.filter(c => !c.done);
  const done = chores.filter(c => c.done);

  const renderChore = useCallback(({ item }: { item: Chore }) => (
    <SwipeableRow
      onDelete={() => handleDelete(item.id)}
      onComplete={!item.done ? () => handleToggleDone(item) : undefined}
      completeLabel="Done"
    >
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: surface, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: bord }}>
      <TouchableOpacity style={{ marginRight: 12 }} onPress={() => handleToggleDone(item)}>
        {item.done
          ? <MaterialIcons name="check-circle" size={28} color="#10B981" />
          : <MaterialIcons name="radio-button-unchecked" size={28} color={muted} />
        }
      </TouchableOpacity>
      
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: item.done ? muted : text, textDecorationLine: item.done ? 'line-through' : 'none' }}>
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#334155' : '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <MaterialIcons name="person-outline" size={12} color={muted} />
            <Text style={{ color: muted, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>{getMemberName(item.assignedToUid)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <MaterialIcons name="schedule" size={12} color="#6366F1" />
            <Text style={{ color: '#6366F1', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{item.time}</Text>
          </View>
          {!!item.day && (
            <View style={{ backgroundColor: isDark ? '#431407' : '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{item.day}</Text>
            </View>
          )}
        </View>
      </View>

      {!item.done && (
        <TouchableOpacity
          onPress={() => handleReminder(item)}
          style={{ backgroundColor: isDark ? '#431407' : '#FFF7ED', padding: 8, borderRadius: 12, marginLeft: 8 }}
        >
          <MaterialIcons name="notifications-active" size={18} color="#D97706" />
        </TouchableOpacity>
      )}
    </View>
    </SwipeableRow>
  ), [getMemberName, handleToggleDone, handleDelete, handleReminder, surface, bord, text, muted, isDark]);

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

      <View className="flex-row items-center gap-3 px-6 mb-6">
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-textMain leading-none">{pending.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Pending</Text>
        </View>
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-success leading-none">{done.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Done</Text>
        </View>
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-textMain leading-none">{chores.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Total</Text>
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            chores.length > 0 ? <Text className="text-textMuted text-xs font-bold tracking-widest mb-3 ml-1">TASKS</Text> : null
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
        onClose={() => setIsModalVisible(false)}
        title="Add Chore"
        scrollEnabled={!showTimePicker}
      >
        <View className="pt-2 pb-2">
          {!showSplitOptions ? (
            <View>
              <View className="border-b border-border/60 pb-2 mb-6">
                <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-1">What needs to be done?</Text>
                <TextInput 
                  ref={inputRef}
                  className="text-textMain text-lg font-bold" 
                  placeholder="e.g. Sweep the floor" 
                  placeholderTextColor="#D1D5DB"
                  value={choreTitle} 
                  onChangeText={setChoreTitle} 
                />
              </View>

              <View className="mb-6">
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
                        className={`w-9 h-9 rounded-full items-center justify-center border ${isSelected ? 'bg-warning border-warning' : 'bg-surfaceRaised border-border'}`}
                      >
                        <Text className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="border-b border-border/60 pb-2 mb-6 flex-row justify-between items-center">
                <Text className="text-textMuted text-xs font-bold w-16">Time</Text>
                <TouchableOpacity 
                  onPress={() => setShowTimePicker(true)}
                  className={`flex-row items-baseline rounded-xl px-3 py-1 ${showTimePicker ? 'bg-primary/5' : ''}`}
                >
                  <Text className="text-xl font-black text-textMain">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]}</Text>
                  <Text className="text-base font-black text-textMuted mx-0.5">:</Text>
                  <Text className="text-xl font-black text-textMain">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]}</Text>
                  <Text className="text-[10px] font-black text-textMuted ml-1 uppercase">{time.getHours() >= 12 ? 'PM' : 'AM'}</Text>
                </TouchableOpacity>
              </View>

              {showTimePicker && (
                <View className="mb-6 border border-border/50 rounded-2xl bg-background/30 p-2">
                  <TimeWheelPicker 
                    initialTime={time}
                    onConfirm={(date) => { setTime(date); setShowTimePicker(false); }}
                    onCancel={() => setShowTimePicker(false)}
                  />
                </View>
              )}

              <View className="flex-row items-center justify-between mb-6 bg-surfaceRaised p-4 rounded-3xl border border-border/50">
                <View className="flex-1">
                  <Text className="text-textMain font-bold text-sm">Automated Rotation</Text>
                  <Text className="text-textMuted text-[10px]">Rotates between members automatically</Text>
                </View>
                <Switch 
                  value={isRotationEnabled}
                  onValueChange={(val) => {
                    setIsRotationEnabled(val);
                    if (val && rotationOrder.length === 0) {
                      setRotationOrder([auth.currentUser?.uid || '']);
                      setAssignedTo(auth.currentUser?.uid || '');
                    }
                  }}
                  trackColor={{ false: '#E2E8F0', true: '#F59E0B' }}
                  thumbColor="#FFF"
                />
              </View>

              <TouchableOpacity 
                onPress={() => setShowSplitOptions(true)}
                className="bg-secondary/30 rounded-2xl py-3.5 px-5 items-center flex-row border border-border/50 mb-6"
              >
                <MaterialIcons name="people" size={20} color="#4F46E5" />
                <Text className="text-textMain font-bold text-sm ml-3 flex-1">
                  {isRotationEnabled 
                    ? `Rotation: ${rotationOrder.length} Members`
                    : `Assignee: ${assignedTo ? getMemberName(assignedTo) : 'Select Person'}`
                  }
                </Text>
                <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <View className="flex-row justify-between mt-2">
                <TouchableOpacity 
                  className="flex-1 bg-background py-3.5 rounded-2xl items-center mr-3 border border-border/40"
                  onPress={() => { setIsModalVisible(false); setShowSplitOptions(false); setChoreTitle(''); }}
                >
                  <Text className="text-textMuted font-bold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 bg-textMain py-3.5 rounded-2xl items-center" 
                  onPress={handleAddChore}
                >
                  <Text className="text-white font-bold text-sm">Save</Text>
                </TouchableOpacity>
              </View>

            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-textMain text-lg font-black">Assign to</Text>
                <TouchableOpacity onPress={() => setShowSplitOptions(false)} className="bg-primary/10 px-3 py-1.5 rounded-full">
                   <Text className="text-primary font-bold text-xs uppercase">Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 290 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                {(members || []).map(uid => {
                  const isSelected = assignedTo === uid;
                  return (
                    <TouchableOpacity 
                      key={uid} 
                      className={`flex-row items-center p-3 rounded-xl mb-2 border ${isSelected ? 'bg-warning/10 border-warning/30' : 'bg-background border-border'} `}
                      onPress={() => {
                        if (isRotationEnabled) {
                          if (rotationOrder.includes(uid)) {
                            setRotationOrder(rotationOrder.filter(id => id !== uid));
                          } else {
                            setRotationOrder([...rotationOrder, uid]);
                            setAssignedTo(rotationOrder[0] || uid); // Default assigned to first in list
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
                      {isRotationEnabled && rotationOrder.includes(uid) && (
                        <View className="bg-warning w-6 h-6 rounded-full items-center justify-center">
                          <Text className="text-white text-[10px] font-black">{rotationOrder.indexOf(uid) + 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
