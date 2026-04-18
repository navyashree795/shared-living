import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, ScrollView, Platform, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeWheelPicker } from '../components/TimeWheelPicker';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Chore } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chores'>;

export default function ChoresScreen({ route, navigation }: Props) {
  const { householdId, members } = route.params;
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [choreTitle, setChoreTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>(auth.currentUser?.uid || '');
  const [deadline, setDeadline] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().getTime() + 3600000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [syncTime, setSyncTime] = useState(new Date());

  useEffect(() => {
    // Simple NTP-like sync (simulated for UI)
    const timer = setInterval(() => setSyncTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const allInvolvedUids = Array.from(new Set([
    ...members,
    ...chores.map(c => c.assignedToUid).filter(Boolean)
  ]));

  const { getMemberName } = useHouseholdMembers(allInvolvedUids);

  useEffect(() => {
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
    
    const formattedStartTime = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    
    try {
      const choreData = {
        title: choreTitle.trim(),
        assignedToUid: assignedTo,
        done: false,
        createdByUid: auth.currentUser?.uid,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        createdAt: serverTimestamp(),
      };

      if (selectedDays.length > 0) {
        // Create ONE chore for all selected days (Consolidated)
        const daysString = selectedDays.join(', ');
        await addDoc(collection(db, 'households', householdId, 'chores'), {
          ...choreData,
          day: daysString,
        });
        logActivity(householdId, 'chore_add', `${choreTitle.trim()} (${daysString})`);
      } else {
        // Just create one for today if no days selected
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        await addDoc(collection(db, 'households', householdId, 'chores'), {
          ...choreData,
          day: today,
        });
        logActivity(householdId, 'chore_add', choreTitle.trim());
      }

      setChoreTitle(''); setAssignedTo(auth.currentUser?.uid || ''); setSelectedDays([]);
      setIsModalVisible(false);
    } catch (e: any) {
      console.error('Chore Add Error:', e);
      Alert.alert('Error', 'Could not add chore. ' + e.message);
    }
  };

  const handleToggleDone = async (chore: Chore) => {
    try {
      const isFinishing = !chore.done;
      await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
        done: isFinishing,
      });
      if (isFinishing) {
        logActivity(householdId, 'chore_done', chore.title);
      }
    } catch (e) {
      console.error('Chore Toggle Error:', e);
      Alert.alert('Error', 'Could not update chore.');
    }
  };

  const handleDelete = async (choreId: string) => {
    Alert.alert('Delete Chore', 'Remove this chore?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'households', householdId, 'chores', choreId));
        } catch (e) {
          Alert.alert('Error', 'Could not delete chore.');
        }
      }}
    ]);
  };

  const pending = chores.filter(c => !c.done);
  const done = chores.filter(c => c.done);

  const renderChore = ({ item }: { item: Chore }) => (
    <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
      <TouchableOpacity className="mr-3" onPress={() => handleToggleDone(item)}>
        {item.done
          ? <MaterialIcons name="check-circle" size={28} color="#10B981" />
          : <MaterialIcons name="radio-button-unchecked" size={28} color="#9CA3AF" />
        }
      </TouchableOpacity>
      
      <View className="flex-1">
        <Text className={`text-base font-bold ${item.done ? 'text-textMuted line-through' : 'text-textMain'}`}>
          {item.title}
        </Text>
        <View className="flex-row items-center mt-1 flex-wrap">
          <View className="flex-row items-center bg-secondary/30 px-2 py-0.5 rounded-md mr-2 mt-1">
            <MaterialIcons name="person-outline" size={14} color="#6B7280" />
            <Text className="text-textMuted text-xs font-medium ml-1">
              {getMemberName(item.assignedToUid)}
            </Text>
          </View>
          <View className="flex-row items-center bg-primary/10 px-2 py-0.5 rounded-md mt-1 border border-primary/20 mr-2">
            <MaterialIcons name="schedule" size={12} color="#4F46E5" />
            <Text className="text-primary text-[10px] font-bold ml-1">
              {item.startTime} - {item.endTime}
            </Text>
          </View>
          {!!item.day && (
            <View className="flex-row items-center bg-warning/10 px-2 py-0.5 rounded-md mt-1 border border-warning/20">
              <Text className="text-warning text-[10px] font-black ml-1 uppercase">{item.day}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2 ml-2">
        <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
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
        <View className="flex-1 bg-white rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-textMain leading-none">{pending.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Pending</Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-success leading-none">{done.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Done</Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4 items-center border border-border shadow-sm">
          <Text className="text-3xl font-extrabold text-textMain leading-none">{chores.length}</Text>
          <Text className="text-textMuted text-xs font-bold mt-1 tracking-wider uppercase">Total</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#F59E0B" className="mt-10" />
      ) : (
        <FlatList
          data={[...pending, ...done]}
          extraData={getMemberName}
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
        scrollEnabled={!showStartPicker && !showEndPicker}
      >
        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-sm font-bold mb-2 ml-1">What needs to be done?</Text>
          <TextInput 
            className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border mb-4" 
            placeholder="e.g. Taking out the trash" 
            placeholderTextColor="#9CA3AF"
            value={choreTitle} 
            onChangeText={setChoreTitle} 
          />
          
          <View className="mb-4 bg-background/50 rounded-2xl p-4 border border-border/50">
            <View className="mb-3 px-1">
              <Text className="text-textMain font-bold">Select Days</Text>
            </View>
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
                    className={`w-9 h-9 rounded-full items-center justify-center border ${isSelected ? 'bg-warning border-warning' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <Text className={`text-[10px] font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}
              className={`flex-1 rounded-[22px] p-4 border-2 ${showStartPicker ? 'bg-primary/5 border-primary' : 'bg-background border-border'} `}
            >
              <Text className={`text-[10px] font-black uppercase mb-1 ${showStartPicker ? 'text-primary' : 'text-textMuted'}`}>Start Time</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-black text-textMain">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]}</Text>
                <Text className="text-lg font-black text-textMuted mx-0.5">:</Text>
                <Text className="text-2xl font-black text-textMain">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]}</Text>
                <Text className="text-[10px] font-black text-textMuted ml-1 uppercase">{startTime.getHours() >= 12 ? 'PM' : 'AM'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}
              className={`flex-1 rounded-[22px] p-4 border-2 ${showEndPicker ? 'bg-primary/5 border-primary' : 'bg-background border-border'} `}
            >
              <Text className={`text-[10px] font-black uppercase mb-1 ${showEndPicker ? 'text-primary' : 'text-textMuted'}`}>End Time</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-black text-textMain">{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]}</Text>
                <Text className="text-lg font-black text-textMuted mx-0.5">:</Text>
                <Text className="text-2xl font-black text-textMain">{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]}</Text>
                <Text className="text-[10px] font-black text-textMuted ml-1 uppercase">{endTime.getHours() >= 12 ? 'PM' : 'AM'}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <View className="mt-4">
              <TimeWheelPicker 
                initialTime={startTime}
                onConfirm={(date) => { setStartTime(date); setShowStartPicker(false); }}
                onCancel={() => setShowStartPicker(false)}
              />
            </View>
          )}

          {showEndPicker && (
            <View className="mt-4">
              <TimeWheelPicker 
                initialTime={endTime}
                onConfirm={(date) => { setEndTime(date); setShowEndPicker(false); }}
                onCancel={() => setShowEndPicker(false)}
              />
            </View>
          )}
        </View>

        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-xs font-bold tracking-widest mb-4">ASSIGN TO</Text>
          {(members || []).map(uid => {
            const isSelected = assignedTo === uid;
            return (
              <TouchableOpacity 
                key={uid} 
                className={`flex-row items-center p-3 rounded-xl mb-2 border ${isSelected ? 'bg-warning/10 border-warning/30' : 'bg-background border-border'} `}
                onPress={() => setAssignedTo(uid)}
              >
                <MaterialIcons
                  name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={24} 
                  color={isSelected ? '#D97706' : '#9CA3AF'}
                />
                <Text className={`text-base font-bold ml-3 ${isSelected ? 'text-warning' : 'text-textMuted'}`}>
                  {getMemberName(uid)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          className="bg-warning rounded-2xl py-4 items-center shadow-lg shadow-warning/30 mb-8" 
          onPress={handleAddChore}
        >
          <Text className="text-white font-bold text-lg">Assign Chore</Text>
        </TouchableOpacity>
      </SlideModal>
    </SafeAreaView>
  );
}
