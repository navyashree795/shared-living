import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Household } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'HouseholdSelection'>;

export default function HouseholdSelectionScreen({ navigation }: Props) {
  const { isDark } = useTheme();
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const accent  = '#6366F1';
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const { setHouseholdId } = useHousehold();

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'households'), where('members', 'array-contains', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setHouseholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Household)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleSelect = (hh: Household) => {
    setHouseholdId(hh.id);
    const state = navigation.getState();
    if (state?.routeNames?.includes('MainTabs')) {
      navigation.navigate('MainTabs');
    }
  };

  const renderItem = ({ item }: { item: Household }) => (
    <TouchableOpacity 
      onPress={() => handleSelect(item)}
      activeOpacity={0.85}
      style={{ backgroundColor: surface, borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: bord, flexDirection: 'row', alignItems: 'center' }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
        <MaterialIcons name="home" size={24} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: text, letterSpacing: -0.3 }}>{item.name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: muted, marginTop: 3 }}>
          {item.members?.length || 0} Member{(item.members?.length !== 1) ? 's' : ''}
        </Text>
      </View>
      <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bord }}>
        <MaterialIcons name="chevron-right" size={20} color={muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: text, letterSpacing: -0.5 }}>My Households</Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: muted, marginTop: 4 }}>Select a household to continue</Text>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert("Sign Out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => auth.signOut() }
          ])}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.15)' }}
        >
          <MaterialIcons name="logout" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={households}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: bord }}>
                  <MaterialIcons name="house-siding" size={32} color={muted} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: text, marginBottom: 8 }}>No households yet</Text>
                <Text style={{ fontSize: 14, color: muted, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>
                  Create your own space or join an existing one using an invite code.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Action Footer */}
      <View style={{ position: 'absolute', bottom: 40, left: 24, right: 24, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('HouseholdSetup', { householdId: null })}
          style={{ flex: 1, backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Create New</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('HouseholdSetup', { activeTab: 'join' })}
          style={{ flex: 1, backgroundColor: surface, paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: bord }}
        >
          <Text style={{ color: text, fontSize: 15, fontWeight: '800' }}>Join Existing</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
