import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHousehold } from '../context/HouseholdContext';
import {
  doc, setDoc, updateDoc, query, collection,
  where, getDocs, arrayUnion,
} from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'HouseholdSetup'>;

export default function HouseholdSetupScreen({ navigation, route }: Props) {
  const { isDark } = useTheme();
  const initialTab = route.params?.activeTab || 'create';
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState(route.params?.code || '');
  const [loading, setLoading] = useState(false);
  const { setHouseholdId } = useHousehold();

  // OTP-style refs
  const codeRefs = useRef<(TextInput | null)[]>([]);
  const [codeDigits, setCodeDigits] = useState<string[]>(
    (route.params?.code || '').split('').concat(Array(6).fill('')).slice(0, 6)
  );

  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const accent  = '#6366F1';

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) { Alert.alert("Error", "Please enter a household name."); return; }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      const code = generateInviteCode();
      const householdId = `hh_${Date.now()}_${code}`;
      const householdData = { name: householdName, inviteCode: code, members: [user.uid], createdBy: user.uid, createdAt: new Date().toISOString() };
      await setDoc(doc(db, "households", householdId), householdData);
      await setDoc(doc(db, "users", user.uid), { householdId }, { merge: true });
      setHouseholdId(householdId);
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

  const handleJoinHousehold = React.useCallback(async (overrideCode?: string) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : inviteCodeInput.trim();
    if (!codeToUse || codeToUse.length !== 6) { Alert.alert('Error', 'Please enter a valid 6-character code.'); return; }
    setLoading(true);
    try {
      const code = codeToUse.toUpperCase();
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      const q = query(collection(db, 'households'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert('Error', 'No household found with this code.'); setLoading(false); return; }
      const householdDoc = snap.docs[0];
      const householdId = householdDoc.id;
      await updateDoc(doc(db, 'households', householdId), { members: arrayUnion(user.uid) });
      await setDoc(doc(db, 'users', user.uid), { householdId }, { merge: true });
      setHouseholdId(householdId);
      Alert.alert('Success', `Joined ${householdDoc.data().name}!`);
      
      const state = navigation.getState();
      if (state?.routeNames?.includes('MainTabs')) {
        navigation.navigate('MainTabs');
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to join household: ${error.message}`);
    }
    setLoading(false);
  }, [inviteCodeInput, navigation]);

  useEffect(() => {
    if (route.params?.code) {
      setActiveTab('join');
      handleJoinHousehold(route.params.code);
    }
  }, [route.params?.code, handleJoinHousehold]);

  const handleCodeChange = (value: string, index: number) => {
    const newDigits = [...codeDigits];
    const upper = value.toUpperCase();
    newDigits[index] = upper;
    setCodeDigits(newDigits);
    const fullCode = newDigits.join('');
    setInviteCodeInput(fullCode);
    if (upper && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
    if (fullCode.length === 6 && !fullCode.includes('')) {
      handleJoinHousehold(fullCode);
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Back button */}
      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bord }}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            
            {/* Title */}
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

            {/* Segmented Control */}
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

            {/* Create Tab */}
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
                <TouchableOpacity onPress={handleCreateHousehold} disabled={loading}
                  style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Create Space</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Join Tab — OTP-style input */}
            {activeTab === 'join' && (
              <View style={{ backgroundColor: surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: bord }}>
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
                  style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Join Space</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Sign Out */}
            <TouchableOpacity onPress={() => auth.signOut()} style={{ marginTop: 32, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
