import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { auth, db } from '../firebaseConfig';
import {
  doc, setDoc, updateDoc, query, collection,
  where, getDocs, arrayUnion,
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'HouseholdSetup'>;

export default function HouseholdSetupScreen({ navigation, route }: Props) {
  const initialTab = route.params?.activeTab || 'create';
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  
  const [householdName, setHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState(route.params?.code || '');
  const [loading, setLoading] = useState(false);

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
      if (!user) throw new Error("No user logged in");
      
      const code = generateInviteCode();
      const householdId = `hh_${Date.now()}_${code}`;

      const householdData = {
        name: householdName,
        inviteCode: code,
        members: [user.uid],
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "households", householdId), householdData);
      await setDoc(doc(db, "users", user.uid), { householdId }, { merge: true });

      Alert.alert("Success", "Household created successfully!");
      
      setTimeout(() => {
        navigation.replace('Dashboard', { 
          householdId, 
          householdData: { id: householdId, ...householdData } 
        });
      }, 0);
    } catch (error: any) {
      Alert.alert("Error", `Failed to create household: ${error.message}`);
    }
    setLoading(false);
  };

  const handleJoinHousehold = React.useCallback(async (overrideCode?: string) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : inviteCodeInput.trim();
    if (!codeToUse || codeToUse.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-character code.');
      return;
    }
    setLoading(true);
    try {
      const code = codeToUse.toUpperCase();
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");

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

      await setDoc(doc(db, 'users', user.uid), { householdId }, { merge: true });

      Alert.alert('Success', `Joined ${householdDoc.data().name}!`);

      setTimeout(() => {
        navigation.replace('Dashboard', {
          householdId,
          householdData: { id: householdId, ...householdDoc.data() } as any,
        });
      }, 0);
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

  const innerContent = (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: 40, paddingHorizontal: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="items-center mb-10 w-full">
          <Text className="text-3xl font-black text-black mb-3 tracking-tighter text-center">
            {activeTab === 'join' ? 'Join Household' : 'Create Household'}
          </Text>
          <Text className="text-sm text-gray-500 text-center leading-5 max-w-[280px]">
            {activeTab === 'join' 
              ? 'Enter a 6-character invite code to join your roommates.' 
              : 'Set up a new shared space for you and your roommates.'}
          </Text>
        </View>

        <View className="w-full bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
          {activeTab === 'create' && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Household Name</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100 mb-6"
                placeholder="e.g. My Awesome Apartment"
                placeholderTextColor="#9CA3AF"
                value={householdName}
                onChangeText={setHouseholdName}
                returnKeyType="done"
                onSubmitEditing={handleCreateHousehold}
              />
              <TouchableOpacity 
                className="bg-black py-4 rounded-2xl items-center justify-center shadow-lg"
                onPress={handleCreateHousehold} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white text-base font-bold tracking-wide">Create Space</Text>}
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'join' && (
            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Invite Code</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100 mb-6 font-bold tracking-widest text-center"
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
                returnKeyType="done"
              />
              <TouchableOpacity
                className="bg-black py-4 rounded-2xl items-center justify-center shadow-lg"
                onPress={() => handleJoinHousehold()}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text className="text-white text-base font-bold tracking-wide">Join Space</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            className="mt-6 py-3 items-center"
            onPress={() => auth.signOut()}
          >
            <Text className="text-gray-400 text-sm font-bold">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]">
      <ScreenHeader navigation={navigation} title="" />
      
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {innerContent}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>
          {innerContent}
        </View>
      )}
    </SafeAreaView>
  );
}
