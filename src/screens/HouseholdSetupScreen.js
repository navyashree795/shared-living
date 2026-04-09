import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { auth, db } from '../firebaseConfig';
import {
  doc, setDoc, updateDoc, query, collection,
  where, getDocs, arrayUnion,
} from 'firebase/firestore';

export default function HouseholdSetupScreen({ navigation, route }) {
  const initialTab = route.params?.activeTab || 'create';
  const [activeTab, setActiveTab] = useState(initialTab); // 'create' | 'join'
  
  const [householdName, setHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState(route.params?.code || '');
  const [loading, setLoading] = useState(false);

  // ─── Auto-join from deep link ─────────────────────────────────────────────
  useEffect(() => {
    if (route.params?.code) {
      setActiveTab('join');
      handleJoinHousehold(route.params.code);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert("Error", "Please enter a household name.");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      const code = generateInviteCode();
      const householdId = `hh_${Date.now()}_${code}`;

      await setDoc(doc(db, "households", householdId), {
        name: householdName,
        inviteCode: code,
        members: [user.uid],
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });

      await setDoc(doc(db, "users", user.uid), {
        householdId: householdId
      }, { merge: true });

      Alert.alert("Success", "Household created successfully!");
      
      setTimeout(() => {
        navigation.replace('Dashboard', { 
          householdId, 
          householdData: { id: householdId, name: householdName, inviteCode: code, members: [user.uid] } 
        });
      }, 0);
    } catch (error) {
      console.error("Error in handleCreateHousehold:", error);
      Alert.alert("Error", `Failed to create household: ${error.message}`);
    }
    setLoading(false);
  };

  const handleJoinHousehold = async (overrideCode) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : inviteCodeInput.trim();
    if (!codeToUse || codeToUse.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-character code.');
      return;
    }
    setLoading(true);
    try {
      const code = codeToUse.toUpperCase();
      const user = auth.currentUser;

      const q = query(
        collection(db, 'households'),
        where('inviteCode', '==', code),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert('Error', 'No household found with this code.');
        setLoading(false);
        return;
      }

      const householdDoc = snap.docs[0];
      const householdId = householdDoc.id;

      await updateDoc(doc(db, 'households', householdId), {
        members: arrayUnion(user.uid),
      });

      await setDoc(
        doc(db, 'users', user.uid),
        { householdId },
        { merge: true },
      );

      Alert.alert('Success', `Joined ${householdDoc.data().name}!`);

      setTimeout(() => {
        navigation.replace('Dashboard', {
          householdId,
          householdData: { id: householdId, ...householdDoc.data() },
        });
      }, 0);
    } catch (error) {
      console.error('handleJoinHousehold error:', error);
      Alert.alert('Error', `Failed to join household: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader navigation={navigation} title={activeTab === 'join' ? 'Join Existing' : 'Create New'} />
          <View className="items-center mb-10">
            <Text className="text-base text-textMuted text-center">
              Create a new household or join an existing one.
            </Text>
          </View>

          <View className="bg-white rounded-3xl p-6 border border-border shadow-sm">

            {/* ── Create Tab ──────────────────────────────────────────── */}
            {activeTab === 'create' && (
              <View className="mb-4">
                <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Household Name</Text>
                <TextInput
                  className="bg-background rounded-xl px-4 py-4 text-textMain text-base border border-border mb-6"
                  placeholder="e.g. My Awesome Apartment"
                  placeholderTextColor="#9CA3AF"
                  value={householdName}
                  onChangeText={setHouseholdName}
                />
                <TouchableOpacity 
                  className="bg-primary py-4 rounded-xl items-center justify-center shadow-sm shadow-primary/50"
                  onPress={handleCreateHousehold} 
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white text-base font-bold">Create Household</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Join Tab ──────────────────────────────────────────── */}
            {activeTab === 'join' && (
              <View className="mb-4">
                <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Invite Code</Text>
                <TextInput
                  className="bg-background rounded-xl px-4 py-4 text-textMain text-base border border-border mb-6 font-bold tracking-widest text-center"
                  placeholder="6-CHAR CODE"
                  placeholderTextColor="#9CA3AF"
                  value={inviteCodeInput}
                  onChangeText={(text) => {
                    const upperText = text.toUpperCase();
                    setInviteCodeInput(upperText);
                    if (upperText.trim().length === 6) {
                      handleJoinHousehold(upperText);
                    }
                  }}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                <TouchableOpacity
                  className="bg-primary py-4 rounded-xl items-center justify-center shadow-sm shadow-primary/50"
                  onPress={handleJoinHousehold}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#FFF" />
                    : <Text className="text-white text-base font-bold">Join Household</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Sign Out */}
            <TouchableOpacity
              className="mt-4 py-4 items-center"
              onPress={() => auth.signOut()}
            >
              <Text className="text-danger text-base font-bold">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}