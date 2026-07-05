/*
 * FILE: src/screens/HouseholdSelectionScreen.tsx
 * PURPOSE: Lists all households/roommate groups the logged-in user belongs to, enabling them to
 *          select one, register a new one, or join one via invitation code.
 * WHERE USED: Shown automatically by RootNavigator if a logged-in user has not selected a household
 *             (householdId is null), or when user chooses to switch households.
 */

// Import React, states, and lifecycle hooks
import React, { useState, useEffect } from 'react';
// Import native components for structures, buttons, scrollable lists, alerts, and loaders
import { View, Text, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
// Import Safe Area views to adjust layout padding automatically
import { SafeAreaView } from 'react-native-safe-area-context';
// Import icon libraries
import { MaterialIcons } from '@expo/vector-icons';
// Import auth reference to perform logouts, and Firestore db reference
import { auth, db } from '../firebaseConfig';
// Import custom context hooks to set the active household and read theme modes
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
// Import Firestore query, collection listeners, and filter helpers
import { collection, query, where, onSnapshot } from 'firebase/firestore';
// Import navigation type hooks
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Household } from '../types';

// Define navigation prop mappings
type Props = NativeStackScreenProps<RootStackParamList, 'HouseholdSelection'>;

/**
 * HouseholdSelectionScreen displays registered spaces and logout controls.
 */
export default function HouseholdSelectionScreen({ navigation }: Props) {
  // Grab dark mode context flag
  const { isDark } = useTheme();

  // Dynamic theme colors mapping based on light/dark mode settings
  const bg      = isDark ? '#070913' : '#F5F7FF'; // Main canvas background color
  const surface = isDark ? '#0E1324' : '#FFFFFF'; // Card backgrounds
  const text    = isDark ? '#F1F5F9' : '#1E1B4B'; // Main text color
  const muted   = isDark ? '#A78BFA' : '#4F46E5'; // Secondary label details color
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)'; // Border outline dividers
  const accent  = '#6366F1'; // Interactive buttons highlight color

  // State hook storing the list of households fetched from the database
  const [households, setHouseholds] = useState<Household[]>([]);
  // State hook tracking database sync loading status
  const [loading, setLoading] = useState(true);
  // Grab the context setHouseholdId function to switch active roommate groups globally
  const { setHouseholdId } = useHousehold();

  // Effect: Connect to Firestore to query all households containing the current user
  useEffect(() => {
    if (!auth.currentUser) return;
    // Build query checking if members array contains active user UID
    const q = query(collection(db, 'households'), where('members', 'array-contains', auth.currentUser.uid));
    // Establish real-time database listener
    const unsub = onSnapshot(q, (snap) => {
      // Map Firestore document data to Household array structures
      setHouseholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Household)));
      setLoading(false);
    }, (error) => {
      console.error("Error querying user households:", error);
      setLoading(false);
    });
    // Cancel query snapshot listener on component unmount
    return unsub;
  }, []);

  // Action: Called when user selects a household card
  const handleSelect = (hh: Household) => {
    // Save the selection globally (writing cache in AsyncStorage background)
    setHouseholdId(hh.id);
    const state = navigation.getState();
    // Redirect to bottom tabs navigator stack
    if (state?.routeNames?.includes('MainTabs')) {
      navigation.navigate('MainTabs');
    }
  };

  // List Item Renderer: Builds visual cards representing each household
  const renderItem = ({ item }: { item: Household }) => (
    <TouchableOpacity 
      onPress={() => handleSelect(item)}
      activeOpacity={0.85}
      style={{ backgroundColor: surface, borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: bord, flexDirection: 'row', alignItems: 'center' }}
    >
      {/* Icon frame */}
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
        <MaterialIcons name="home" size={24} color={accent} />
      </View>
      {/* Household details */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: text, letterSpacing: -0.3 }}>{item.name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: muted, marginTop: 3 }}>
          {item.members?.length || 0} Member{(item.members?.length !== 1) ? 's' : ''}
        </Text>
      </View>
      {/* Right chevron indicator */}
      <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bord }}>
        <MaterialIcons name="chevron-right" size={20} color={muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header section containing Page Title and Sign Out Button */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: text, letterSpacing: -0.5 }}>My Households</Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: muted, marginTop: 4 }}>Select a household to continue</Text>
        </View>
        {/* Sign Out click button trigger */}
        <TouchableOpacity
          onPress={() => Alert.alert("Sign Out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            // Triggers Firebase Auth session logouts, routing user back to LoginScreen
            { text: "Sign Out", style: "destructive", onPress: () => auth.signOut() }
          ])}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.15)' }}
        >
          <MaterialIcons name="logout" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Main List Area */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
        {loading ? (
          // Display spinner while Firestore sync queries run
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
            // Fallback UI overlay displayed if the user has no registered roommate groups
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

      {/* Floating Action Footer containing Create and Join triggers */}
      <View style={{ position: 'absolute', bottom: 40, left: 24, right: 24, flexDirection: 'row', gap: 12 }}>
        {/* Navigation button directing user to Create Household Form Screen */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('HouseholdSetup', { householdId: null })}
          style={{ flex: 1, backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Create New</Text>
        </TouchableOpacity>
        {/* Navigation button directing user to Join Household Form Screen */}
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
