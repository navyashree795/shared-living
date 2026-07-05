/*
 * FILE: src/screens/HouseholdSetupScreen.tsx
 * PURPOSE: Provides forms to register new roommate/travel spaces or join existing ones.
 *          It coordinates client-side geolocation pinning (for roommate houses), invite code checks,
 *          and OTP-style keyboard focus selectors.
 * WHERE USED: Routed from HouseholdSelectionScreen when selecting "Create New" or "Join Existing" options.
 */

// Import React hooks for states, lifecycles, and direct element reference hooks
import React, { useState, useEffect, useRef } from 'react';
// Import essential React Native layout structures, input fields, spinners, and touch zones
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, ScrollView,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
// Import Safe Area utilities
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import keyboard avoiding properties calculator
import { getKeyboardAvoidingProps } from '../utils/keyboardUtils';
// Import auth session references and Firestore database
import { auth, db } from '../firebaseConfig';
// Import custom household context hook to set active household IDs globally
import { useHousehold } from '../context/HouseholdContext';
// Import Firestore query document references, writes, filter queries, and list updates
import {
  doc, setDoc, updateDoc, query, collection,
  where, getDocs, arrayUnion,
} from 'firebase/firestore';
// Import custom theme hook
import { useTheme } from '../context/ThemeContext';
// Import navigation parameter type mappings
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
// Import invitation validations API modules
import { validateInvitation, acceptInvitation } from '../utils/invitationApi';
// Import Expo Location SDK to fetch active GPS coordinates of the phone
import * as Location from 'expo-location';

// Define navigation types for props
type Props = NativeStackScreenProps<RootStackParamList, 'HouseholdSetup'>;

/**
 * HouseholdSetupScreen displays segments for setting up new or joining existing roommate/travel groups.
 */
export default function HouseholdSetupScreen({ navigation, route }: Props) {
  // Grab safe area top padding
  const insets = useSafeAreaInsets();
  // Get keyboard behavior settings
  const { behavior, keyboardVerticalOffset } = getKeyboardAvoidingProps('setup', insets.top);

  // Grab active theme mode
  const { isDark } = useTheme();
  
  // Set default initial tab based on parameters passed from the selection screen ('create' or 'join')
  const initialTab = route.params?.activeTab || 'create';
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  
  // Create tab inputs
  const [householdName, setHouseholdName] = useState('');
  const [householdType, setHouseholdType] = useState<'roommate' | 'travel'>('roommate');
  const [tripEndDate, setTripEndDate] = useState('');
  const [retentionPolicy, setRetentionPolicy] = useState<'7_days_trip_end' | '15_days_trip_end'>('7_days_trip_end');
  
  // Join tab inputs
  const [inviteCodeInput, setInviteCodeInput] = useState(route.params?.code || '');
  const [pastedLink, setPastedLink] = useState('');
  
  // Loader spinner state
  const [loading, setLoading] = useState(false);
  // Grab global household set id callback
  const { setHouseholdId } = useHousehold();

  // OTP-style input refs to handle keyboard focus jumps between characters
  const codeRefs = useRef<(TextInput | null)[]>([]);
  // Digit array to track characters inputted in the 6 invite fields
  const [codeDigits, setCodeDigits] = useState<string[]>(
    (route.params?.code || '').split('').concat(Array(6).fill('')).slice(0, 6)
  );

  // Theme colors mapping
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const accent  = '#6366F1';

  // Helper to generate a random 6-character alphanumeric uppercase invitation code
  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  // Action: Executes household creation and database insertions
  const handleCreateHousehold = async () => {
    if (!householdName.trim()) { Alert.alert("Error", "Please enter a household name."); return; }
    
    let homeLocation: { latitude: number; longitude: number } | null = null;
    
    // If roommate household, request location permissions to lock in GPS home coordinates
    if (householdType === 'roommate') {
      try {
        setLoading(true);
        // Request GPS coordinates access
        const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
        if (foreStatus !== 'granted') {
          Alert.alert(
            "Location Permission Required",
            "This app requires location access to automatically mark roommates as 'At Home' or 'Out'. Please enable location services in settings to proceed."
          );
          setLoading(false);
          return;
        }
        
        // Grab latitude/longitude coordinates
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        homeLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      } catch (err: any) {
        console.error("Failed to pin home location during household creation:", err);
        Alert.alert(
          "Location Error",
          "Could not verify your current location. Please make sure location services are enabled on your device and try again."
        );
        setLoading(false);
        return;
      }
    }
    
    // If travel trip, validate date parameters format
    if (householdType === 'travel') {
      if (!tripEndDate.trim()) {
        Alert.alert("Error", "Please enter the Trip End Date.");
        return;
      }
      const dateMatch = tripEndDate.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
      if (!dateMatch) {
        Alert.alert("Error", "Please enter a valid date in YYYY-MM-DD format.");
        return;
      }
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      const parsedDate = new Date(year, month, day);
      if (isNaN(parsedDate.getTime())) {
        Alert.alert("Error", "Please enter a valid calendar date.");
        return;
      }
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      const code = generateInviteCode();
      const newHouseholdId = `hh_${Date.now()}_${code}`;

      // Assemble household schema document data
      const householdData: any = { 
        name: householdName.trim(), 
        inviteCode: code, 
        members: [user.uid], 
        createdBy: user.uid, 
        createdAt: new Date().toISOString(), 
        type: householdType 
      };

      // Include locked GPS coordinates if roommate flat
      if (householdType === 'roommate' && homeLocation) {
        householdData.info = {
          homeLocation
        };
      }

      // Compute data retention expiration date if trip household
      if (householdType === 'travel') {
        const dateMatch = tripEndDate.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)!;
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        const day = parseInt(dateMatch[3], 10);
        const parsedDate = new Date(year, month, day, 23, 59, 59, 999); // Set to end of day
        
        // Expiration limit defaults (7 days or 15 days after trip ends)
        const daysToAdd = retentionPolicy === '15_days_trip_end' ? 15 : 7;
        const expirationDate = new Date(parsedDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

        householdData.tripDetails = {
          endDate: tripEndDate.trim()
        };
        householdData.retentionPolicy = retentionPolicy;
        householdData.expiresAt = expirationDate.toISOString();
      }

      // Write household document and link household ID to user profile
      await setDoc(doc(db, "households", newHouseholdId), householdData);
      await setDoc(doc(db, "users", user.uid), { householdId: newHouseholdId }, { merge: true });
      
      // Update global context active ID
      setHouseholdId(newHouseholdId);
      Alert.alert("Success", "Household created successfully!");
      
      const state = navigation.getState();
      if (state?.routeNames?.includes('MainTabs')) {
        navigation.navigate('MainTabs');
      }
    } catch (error: any) {
      Alert.alert("Error", `Failed to create household: ${error.message}`);
    }
    setLoading(false);
  };

  // Action: Executes household lookup using invite code and registers user to members list
  const handleJoinHousehold = React.useCallback(async (overrideCode?: string) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : inviteCodeInput.trim();
    if (!codeToUse || codeToUse.length !== 6) { Alert.alert('Error', 'Please enter a valid 6-character code.'); return; }
    
    setLoading(true);
    try {
      const code = codeToUse.toUpperCase();
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      
      // Query Firestore looking for household matching code
      const q = query(collection(db, 'households'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      
      if (snap.empty) { Alert.alert('Error', 'No household found with this code.'); setLoading(false); return; }
      
      const householdDoc = snap.docs[0];
      const joinedHouseholdId = householdDoc.id;
      
      // Add user UID to members list and update user profile
      await updateDoc(doc(db, 'households', joinedHouseholdId), { members: arrayUnion(user.uid) });
      await setDoc(doc(db, 'users', user.uid), { householdId: joinedHouseholdId }, { merge: true });
      
      // Switch active context
      setHouseholdId(joinedHouseholdId);
      Alert.alert('Success', `Joined ${householdDoc.data().name}!`);
      
      const state = navigation.getState();
      if (state?.routeNames?.includes('MainTabs')) {
        navigation.navigate('MainTabs');
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to join household: ${error.message}`);
    }
    setLoading(false);
  }, [inviteCodeInput, setHouseholdId, navigation]);

  // Hook to handle deep code joins forwarded from other screens on parameters changes
  useEffect(() => {
    if (route.params?.code) {
      setActiveTab('join');
      handleJoinHousehold(route.params.code);
    }
  }, [route.params?.code, handleJoinHousehold]);

  // Extract invite token uuid from link strings
  const extractToken = (urlStr: string): string | null => {
    try {
      const match = urlStr.match(/\/invite\/([a-zA-Z0-9_\-]+)/);
      if (match) return match[1];
      const isGuid = /^[a-zA-Z0-9_\-]{32,36}$/.test(urlStr.trim());
      if (isGuid) return urlStr.trim();
      return null;
    } catch (e) {
      console.error("Error parsing invite URL:", e);
      return null;
    }
  };

  // Action: Join household using shared link validation API
  const handleJoinViaLink = async () => {
    const token = extractToken(pastedLink);
    if (!token) {
      Alert.alert("Invalid Input", "Please enter a valid invitation link or a 36-character token.");
      return;
    }
    setLoading(true);
    try {
      // Validate token status
      const validation = await validateInvitation(token);
      if (!validation.valid) {
        Alert.alert("Invalid Link", validation.message || "This invitation link is invalid or expired.");
        setLoading(false);
        return;
      }

      // Prompt confirmation alert dialog
      Alert.alert(
        "Join Household",
        `You have been invited to join the household "${validation.householdName}".\n\nWould you like to join?`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
          {
            text: "Join",
            // Triggers Firestore atomic transactions
            onPress: async () => {
              try {
                setLoading(true);
                const result = await acceptInvitation(token);
                if (result.success) {
                  setHouseholdId(result.householdId);
                  Alert.alert("Success", `Joined "${validation.householdName}" successfully!`);
                  const state = navigation.getState();
                  if (state?.routeNames?.includes('MainTabs')) {
                    navigation.navigate('MainTabs');
                  }
                } else {
                  Alert.alert("Error", "Failed to join household.");
                }
              } catch (err: any) {
                console.error("Error joining household:", err);
                Alert.alert("Error Joining", err.message || "Something went wrong while joining.");
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (err: any) {
      console.error("Error validating invitation:", err);
      Alert.alert("Error", err.message || "Error validating invitation link");
      setLoading(false);
    }
  };

  // Callback to handle OTP digit character changes and jump focus to the next field
  const handleCodeChange = (value: string, index: number) => {
    const newDigits = [...codeDigits];
    const upper = value.toUpperCase();
    newDigits[index] = upper;
    setCodeDigits(newDigits);
    const fullCode = newDigits.join('');
    setInviteCodeInput(fullCode);
    
    // Jump focus to next textinput field if user entered a character
    if (upper && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
    // Automatically submit once all 6 characters are inputted
    if (fullCode.length === 6 && !fullCode.includes('')) {
      handleJoinHousehold(fullCode);
    }
  };

  // Callback handling backspace keypress on empty OTP fields to jump focus backwards
  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Page header back indicator button */}
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bord }}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false} 
          bounces={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
              
              {/* Header illustration layout */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <MaterialIcons name={activeTab === 'create' ? 'add-home' : 'group-add'} size={28} color="#fff" />
                </View>
                <Text style={{ fontSize: 24, fontWeight: '900', color: text, letterSpacing: -0.5, marginBottom: 8 }}>
                  {activeTab === 'create' ? 'Create Household' : 'Join Household'}
                </Text>
                <Text style={{ fontSize: 14, color: muted, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>
                  {activeTab === 'create' ? 'Set up a new shared space for your roommates.' : 'Enter the 6-character invite code from your roommate.'}
                </Text>
              </View>

              {/* Segmented Mode Tab Toggle Control (Create vs Join) */}
              <View style={{ flexDirection: 'row', backgroundColor: surface, borderRadius: 16, padding: 4, marginBottom: 28, borderWidth: 1, borderColor: bord }}>
                {(['create', 'join'] as const).map(tab => (
                  <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: activeTab === tab ? accent : 'transparent' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: activeTab === tab ? '#fff' : muted }}>
                      {tab === 'create' ? 'Create' : 'Join'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CREATE TAB FORM CARD */}
              {activeTab === 'create' && (
                <View style={{ backgroundColor: surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: bord }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>Household Name</Text>
                  <TextInput
                    style={{ backgroundColor: bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, color: text, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: bord, marginBottom: 20 }}
                    placeholder="e.g. My Awesome Apartment"
                    placeholderTextColor="#475569"
                    value={householdName}
                    onChangeText={setHouseholdName}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateHousehold}
                  />
                  
                  {/* Purpose Toggle Control (Roommates vs Travel Trips) */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>Purpose</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: bord }}>
                    {(['roommate', 'travel'] as const).map(t => (
                      <TouchableOpacity key={t} onPress={() => setHouseholdType(t)}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: householdType === t ? accent : 'transparent' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: householdType === t ? '#fff' : muted }}>
                          {t === 'roommate' ? '🏡 Roommates' : '✈️ Travel'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Travel type settings: date picker and deletion policy selectors */}
                  {householdType === 'travel' && (
                    <>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>Trip End Date</Text>
                      <TextInput
                        style={{ backgroundColor: bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, color: text, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: bord, marginBottom: 20 }}
                        placeholder="YYYY-MM-DD (e.g. 2026-07-10)"
                        placeholderTextColor="#475569"
                        value={tripEndDate}
                        onChangeText={setTripEndDate}
                        returnKeyType="done"
                      />
                      
                      <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>Auto-Delete Policy</Text>
                      <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: bord }}>
                        {(['7_days_trip_end', '15_days_trip_end'] as const).map(p => (
                          <TouchableOpacity key={p} onPress={() => setRetentionPolicy(p)}
                            style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: retentionPolicy === p ? accent : 'transparent' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: retentionPolicy === p ? '#fff' : muted }}>
                              {p === '7_days_trip_end' ? 'Delete after 7 days' : 'Delete after 15 days'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Submit trigger button */}
                  <TouchableOpacity onPress={handleCreateHousehold} disabled={loading}
                    style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Create Space</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* JOIN TAB FORM CARD */}
              {activeTab === 'join' && (
                <View style={{ backgroundColor: surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: bord }}>
                  {/* Alphanumeric Invite Code Fields */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, paddingLeft: 4 }}>Invite Code</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 24 }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <TextInput
                        key={i}
                        ref={ref => { codeRefs.current[i] = ref; }}
                        style={{
                          flex: 1, height: 56, borderRadius: 14, backgroundColor: bg, borderWidth: 2,
                          borderColor: codeDigits[i] ? accent : bord,
                          color: text, fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: 2
                        }}
                        maxLength={1}
                        autoCapitalize="characters"
                        value={codeDigits[i]}
                        onChangeText={v => handleCodeChange(v, i)}
                        onKeyPress={e => handleCodeKeyPress(e, i)}
                      />
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => handleJoinHousehold()} disabled={loading}
                    style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 20 }}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Join with Code</Text>}
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: bord }} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: muted, marginHorizontal: 12, textTransform: 'uppercase', letterSpacing: 1 }}>OR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: bord }} />
                  </View>

                  {/* Manual Paste Link Section */}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingLeft: 4 }}>Invitation Link or Token</Text>
                  <TextInput
                    style={{ backgroundColor: bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, color: text, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: bord, marginBottom: 20 }}
                    placeholder="Paste invite link or token here"
                    placeholderTextColor="#475569"
                    value={pastedLink}
                    onChangeText={setPastedLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleJoinViaLink} disabled={loading}
                    style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Join via Link</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* Sign Out link trigger at the bottom */}
              <TouchableOpacity onPress={() => auth.signOut()} style={{ marginTop: 32, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
