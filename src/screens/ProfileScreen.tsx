import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from '../components/Avatar';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, profile } = useUser();
  const { householdData, setHouseholdId } = useHousehold();
  const { isDark, toggleTheme } = useTheme();

  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editing, setEditing] = useState(false);

  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const raised  = isDark ? '#181F38' : '#EEF2FF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const primary = '#6366F1';

  const handleSave = async () => {
    if (!editUsername.trim() || !auth.currentUser) {
      Alert.alert('Error', 'Please enter a valid username');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username: editUsername.trim().toLowerCase(),
      });
      setEditing(false);
      Alert.alert('Success', 'Username updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => { setHouseholdId(null); auth.signOut(); },
      },
    ]);
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(householdData?.inviteCode || '');
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {/* Custom Header with Back Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: raised, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: bord }}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 28, fontWeight: '900', color: text, letterSpacing: -0.5 }}>
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }} showsVerticalScrollIndicator={false}>

        {/* Avatar + Name */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Avatar
            name={profile?.username || user?.email || 'U'}
            size={80}
            bgColor={primary}
            color="#fff"
            style={{ borderRadius: 28, marginBottom: 12 }}
          />
          <Text style={{ fontSize: 22, fontWeight: '800', color: text }}>
            @{profile?.username || 'unknown'}
          </Text>
          <Text style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            {user?.email}
          </Text>
        </View>

        {/* Edit Username */}
        <View style={{ backgroundColor: surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: bord }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Display Name
          </Text>
          {editing ? (
            <>
              <TextInput
                value={editUsername}
                onChangeText={setEditUsername}
                autoCapitalize="none"
                autoFocus
                style={{ fontSize: 16, fontWeight: '700', color: text, borderBottomWidth: 1, borderColor: primary, paddingBottom: 8, marginBottom: 16 }}
                placeholderTextColor={muted}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  style={{ flex: 1, backgroundColor: raised, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: muted, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={{ flex: 1, backgroundColor: primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>
                {profile?.username || 'Set username'}
              </Text>
              <MaterialIcons name="edit" size={18} color={muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Household Section */}
        {householdData && (
          <View style={{ backgroundColor: surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: bord }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Household
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: text, marginBottom: 16 }}>
              {householdData.name}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Invite Code
            </Text>
            <TouchableOpacity
              onPress={copyCode}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: raised, borderRadius: 14, padding: 16 }}
            >
              <Text style={{ fontSize: 22, fontWeight: '900', color: primary, letterSpacing: 6 }}>
                {householdData.inviteCode}
              </Text>
              <MaterialIcons name="content-copy" size={20} color={muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Appearance */}
        <View style={{ backgroundColor: surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: bord }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Appearance
          </Text>
          <TouchableOpacity
            onPress={toggleTheme}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={20} color={primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: isDark ? primary : raised, borderWidth: 1, borderColor: bord, justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start', elevation: 2 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{ backgroundColor: isDark ? '#3B1219' : '#FEF2F2', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: isDark ? '#7F1D1D' : '#FECACA', marginBottom: 40 }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="logout" size={20} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
