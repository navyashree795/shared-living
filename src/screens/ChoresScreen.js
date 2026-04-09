import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';

export default function ChoresScreen({ route, navigation }) {
  const { householdId, members } = route.params;
  const [chores, setChores] = useState([]);
  const { memberProfiles, getMemberName } = useHouseholdMembers(members);

  useEffect(() => {
    const q = query(
      collection(db, 'households', householdId, 'chores'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setChores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);



  const handleAddChore = async () => {
    if (!choreTitle.trim()) { Alert.alert('Error', 'Please enter a chore name.'); return; }
    try {
      console.log(`Adding chore to households/${householdId}/chores`);
      await addDoc(collection(db, 'households', householdId, 'chores'), {
        title: choreTitle.trim(),
        assignedToUid: assignedTo,
        done: false,
        createdByUid: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      setChoreTitle(''); setAssignedTo(auth.currentUser?.uid || '');
      setIsModalVisible(false);
    } catch (e) {
      console.error('Chore Add Error:', e);
      Alert.alert('Error', 'Could not add chore. ' + e.message);
    }
  };

  const handleToggleDone = async (chore) => {
    try {
      console.log(`Updating chore households/${householdId}/chores/${chore.id}`);
      await updateDoc(doc(db, 'households', householdId, 'chores', chore.id), {
        done: !chore.done,
      });
    } catch (e) {
      console.error('Chore Toggle Error:', e);
      Alert.alert('Error', 'Could not update chore.');
    }
  };

  const handleDelete = async (choreId) => {
    Alert.alert('Delete Chore', 'Remove this chore?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'households', householdId, 'chores', choreId));
      }}
    ]);
  };

  const pending = chores.filter(c => !c.done);
  const done = chores.filter(c => c.done);

  const renderChore = ({ item }) => (
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
        <View className="flex-row items-center mt-1 bg-secondary/30 self-start px-2 py-0.5 rounded-md">
          <MaterialIcons name="person-outline" size={14} color="#6B7280" />
          <Text className="text-textMuted text-xs font-medium ml-1">
            {getMemberName(item.assignedToUid)}
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2 ml-2">
        <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <ScreenHeader 
        navigation={navigation} 
        title="Chores" 
        rightIcon="add" 
        rightIconColor="#D97706"
        rightIconBg="bg-warning/10"
        rightIconBorder="border-warning/30"
        onRightPress={() => setIsModalVisible(true)} 
      />

      {/* Stats row */}
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
          keyExtractor={i => i.id}
          renderItem={renderChore}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ListHeaderComponent={
            chores.length > 0 && <Text className="text-textMuted text-xs font-bold tracking-widest mb-3 ml-1">TASKS</Text>
          }
          ListEmptyComponent={
            <EmptyState 
              icon="cleaning-services" 
              title="No chores assigned" 
              description="Your home is spotless! Tap the + button to assign new tasks."
              iconBg="bg-warning/10"
              iconColor="#D97706"
            />
          }
        />
      )}

      {/* Add Chore Modal */}
      <SlideModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title="Add Chore"
      >
        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-sm font-bold mb-2 ml-1">What needs to be done?</Text>
          <TextInput 
            className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border" 
            placeholder="e.g. Taking out the trash" 
            placeholderTextColor="#9CA3AF"
            value={choreTitle} 
            onChangeText={setChoreTitle} 
          />
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
