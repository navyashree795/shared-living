import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, updateDoc, setDoc, query, collection, where, getDocs, arrayUnion } from 'firebase/firestore';

export default function HouseholdSetupScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'join', 'invites'
  const [householdName, setHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    if (activeTab === 'invites') {
      fetchInvites();
    }
  }, [activeTab]);

  useEffect(() => {
    if (route.params?.code) {
      setInviteCodeInput(route.params.code);
      setActiveTab('join');
    }
  }, [route.params?.code]);

  const fetchInvites = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const invitesRef = collection(db, "users", auth.currentUser.uid, "invites");
      const q = query(invitesRef, where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      const fetchedInvites = [];
      querySnapshot.forEach((doc) => {
        fetchedInvites.push({ id: doc.id, ...doc.data() });
      });
      setInvites(fetchedInvites);
    } catch (error) {
      console.error("Error fetching invites:", error);
    }
    setLoading(false);
  };

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
      navigation.navigate('Dashboard', { 
        householdId, 
        householdData: { id: householdId, name: householdName, inviteCode: code, members: [user.uid] } 
      });
    } catch (error) {
      console.error("DEBUG: Error in handleCreateHousehold:", error);
      Alert.alert("Error", `Failed to create household: ${error.message}`);
    }
    setLoading(false);
  };

  const handleJoinHousehold = async () => {
    if (!inviteCodeInput.trim() || inviteCodeInput.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-character code.");
      return;
    }
    setLoading(true);
    try {
      const code = inviteCodeInput.toUpperCase();
      const user = auth.currentUser;
      
      const q = query(collection(db, "households"), where("inviteCode", "==", code));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        Alert.alert("Error", "No household found with this code.");
        setLoading(false);
        return;
      }
      
      const householdDoc = querySnapshot.docs[0];
      const householdId = householdDoc.id;
      
      await updateDoc(doc(db, "households", householdId), {
        members: arrayUnion(user.uid)
      });
      
      await setDoc(doc(db, "users", user.uid), {
        householdId: householdId
      }, { merge: true });
      
      Alert.alert("Success", `Joined ${householdDoc.data().name}!`);
      navigation.navigate('Dashboard', { 
        householdId, 
        householdData: { id: householdId, ...householdDoc.data() } 
      });
    } catch (error) {
      console.error("DEBUG: Error in handleJoinHousehold:", error);
      Alert.alert("Error", `Failed to join household: ${error.message}`);
    }
    setLoading(false);
  };

  const handleAcceptInvite = async (inviteId, householdId) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      
      await updateDoc(doc(db, "households", householdId), {
        members: arrayUnion(user.uid)
      });
      
      await setDoc(doc(db, "users", user.uid), {
        householdId: householdId
      }, { merge: true });

      await updateDoc(doc(db, "users", user.uid, "invites", inviteId), {
        status: "accepted"
      });

      Alert.alert("Success", "Welcome to your new household!");
      navigation.navigate('Dashboard', { householdId });
    } catch (error) {
      console.error("Error accepting invite:", error);
      Alert.alert("Error", "Failed to accept invite.");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
          
          <View className="items-center mb-10">
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              className="absolute left-0 top-0 p-2"
            >
              <MaterialIcons name="arrow-back" size={24} color="#4F46E5" />
            </TouchableOpacity>
            <Text className="text-3xl font-extrabold text-primary mb-2">Setup</Text>
            <Text className="text-base text-textMuted text-center">Let's get you set up with a household.</Text>
          </View>

          <View className="bg-white rounded-3xl p-6 border border-border shadow-sm">
            {/* Tabs */}
            <View className="flex-row bg-background rounded-2xl p-1.5 mb-8 border border-border">
              <TouchableOpacity 
                className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'create' ? 'bg-primary shadow-sm shadow-primary/30' : ''}`}
                onPress={() => setActiveTab('create')}
              >
                <Text className={`font-bold ${activeTab === 'create' ? 'text-white' : 'text-textMuted'}`}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'join' ? 'bg-primary shadow-sm shadow-primary/30' : ''}`}
                onPress={() => setActiveTab('join')}
              >
                <Text className={`font-bold ${activeTab === 'join' ? 'text-white' : 'text-textMuted'}`}>Join</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'invites' ? 'bg-primary shadow-sm shadow-primary/30' : ''}`}
                onPress={() => setActiveTab('invites')}
              >
                <Text className={`font-bold ${activeTab === 'invites' ? 'text-white' : 'text-textMuted'}`}>Invites</Text>
              </TouchableOpacity>
            </View>

            {/* Create Tab Content */}
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

            {/* Join Tab Content */}
            {activeTab === 'join' && (
              <View className="mb-4">
                <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Invite Code</Text>
                <TextInput
                  className="bg-background rounded-xl px-4 py-4 text-textMain text-base border border-border mb-6 font-bold tracking-widest text-center"
                  placeholder="6-CHAR CODE"
                  placeholderTextColor="#9CA3AF"
                  value={inviteCodeInput}
                  onChangeText={setInviteCodeInput}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                <TouchableOpacity 
                  className="bg-primary py-4 rounded-xl items-center justify-center shadow-sm shadow-primary/50"
                  onPress={handleJoinHousehold} 
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white text-base font-bold">Join Household</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Invites Tab Content */}
            {activeTab === 'invites' && (
              <View className="mb-4">
                {loading ? (
                  <ActivityIndicator size="large" color="#4F46E5" className="my-6" />
                ) : invites.length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-textMuted text-base font-medium">No pending invitations.</Text>
                  </View>
                ) : (
                  invites.map((invite) => (
                    <View key={invite.id} className="bg-background p-5 rounded-2xl mb-3 border border-border flex-row items-center justify-between shadow-sm">
                      <View className="flex-1 pr-4">
                        <Text className="text-textMain text-sm leading-5">
                          <Text className="font-extrabold">{invite.inviterEmail}</Text> invited you to <Text className="font-extrabold text-primary">{invite.householdName}</Text>
                        </Text>
                      </View>
                      <TouchableOpacity 
                        className="bg-success px-4 py-2.5 rounded-xl shadow-sm shadow-success/40"
                        onPress={() => handleAcceptInvite(invite.id, invite.householdId)}
                      >
                        <Text className="text-white font-bold text-sm">Accept</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            <TouchableOpacity 
              className="mt-6 py-4 items-center" 
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
