import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function HouseholdSelectionScreen({ navigation }) {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Discovery query for households where the user is a member
    const q = query(
      collection(db, 'households'),
      where('members', 'array-contains', auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setHouseholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching households:", err);
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleSelect = (hh) => {
    navigation.navigate('Dashboard', { householdId: hh.id, householdData: hh });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
      className="bg-white rounded-[32px] p-6 mb-4 border border-border shadow-sm flex-row items-center"
    >
      <View className="w-12 h-12 rounded-2xl bg-secondary items-center justify-center mr-4">
        <MaterialIcons name="home" size={24} color="#4B5563" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-textMain tracking-tight">{item.name}</Text>
        <Text className="text-textMuted text-xs font-medium mt-0.5">
          {item.members?.length || 0} Member{(item.members?.length !== 1) ? 's' : ''}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-textMuted text-sm mt-4 font-medium">Discovering households...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="mt-8 mb-10">
        <Text className="text-4xl font-black text-textMain tracking-tighter">My Projects</Text>
        <Text className="text-textMuted text-base font-medium mt-1">Select a household to continue</Text>
      </View>

      <FlatList
        data={households}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center mt-12 bg-white p-10 rounded-[40px] border border-border border-dashed">
            <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center mb-6 border border-primary/10">
               <MaterialIcons name="house-siding" size={40} color="#4F46E5" />
            </View>
            <Text className="text-xl font-bold text-textMain mb-2 text-center">No households joined</Text>
            <Text className="text-textMuted text-sm text-center px-4 leading-5">
              Create your own project or join an existing one using an invite code.
            </Text>
          </View>
        }
      />

      {/* Action Footer */}
      <View className="absolute bottom-10 left-6 right-6 flex-row gap-4">
        <TouchableOpacity 
          onPress={() => navigation.navigate('HouseholdSetup', { householdId: null })} // Pass null to indicate brand new setup
          className="flex-1 bg-primary py-4 rounded-2xl items-center shadow-lg shadow-primary/30"
        >
          <Text className="text-white font-bold text-base">Create New</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('HouseholdSetup', { activeTab: 'join' })}
          className="flex-1 bg-white py-4 rounded-2xl items-center border border-border shadow-sm"
        >
          <Text className="text-textMain font-bold text-base">Join Existing</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
