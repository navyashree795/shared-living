/*
 * FILE: src/screens/ProfileScreen.tsx
 * PURPOSE: Manages user profile settings, display usernames, profile images uploads, active theme selection,
 *          household billing cycles start dates, and historical logs archive queries.
 * WHERE USED: Rendered as the third tab option within MainTabs (App.tsx).
 */

// Import React hooks for managing state parameters, side-effect triggers, and ref values
import React, { useState } from 'react';
// Import essential layout components, text elements, touch areas, text inputs, alerts, lists, spinners, and share tools
import {
  View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator,
  Platform, KeyboardAvoidingView, Share,
} from 'react-native';
// Import invitation generation API helper
import { createInvitation } from '../utils/invitationApi';
// Import safe area providers to prevent notch/home indicator overlaps
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import keyboard offset adjustment helpers
import { getKeyboardAvoidingProps } from '../utils/keyboardUtils';
// Import React Navigation hook
import { useNavigation } from '@react-navigation/native';
// Import auth reference, database, and firebase storage connections
import { auth, db } from '../firebaseConfig';
// Import Firestore commands to modify user details, retrieve collections, delete documents, and write atomic batches
import { doc, updateDoc, collection, getDocs, deleteDoc, arrayRemove, writeBatch, getDoc } from 'firebase/firestore';
// Import Expo ImagePicker to select images from the phone's gallery
import * as ImagePicker from 'expo-image-picker';
// Import User and Household contexts to update global states (e.g. logging out or swapping household IDs)
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
// Import custom avatar rendering component
import { Avatar } from '../components/Avatar';
// Import time synchronization helpers
import { getSyncedDate } from '../utils/timeUtils';
// Import database data retention helpers
import { getCycleStartDate, enforceDataRetentionPolicy } from '../utils/retentionUtils';
// Import custom slide-up bottom modal component
import SlideModal from '../components/SlideModal';
// Import copy to clipboard utilities
import * as Clipboard from 'expo-clipboard';
// Import in-app web browser opener
import * as WebBrowser from 'expo-web-browser';

/**
 * ProfileScreen component structure.
 */
export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Grab keyboard vertical behavior settings for the profile page
  const { behavior, keyboardVerticalOffset } = getKeyboardAvoidingProps('profile', insets.top);

  // Grab logged-in user profile attributes from context
  const { user, profile } = useUser();
  // Grab household settings from context
  const { householdId, householdData, setHouseholdId } = useHousehold();
  // Grab current active theme (light/dark)
  const { isDark, toggleTheme } = useTheme();

  // State mapping to store edited username strings
  const [editUsername, setEditUsername] = useState(profile?.username ? profile.username.replace(/^@+/, '') : '');
  // Toggle flag showing if username text input editing is active
  const [editing, setEditing] = useState(false);
  // Toggle flag showing if image upload operations are processing
  const [uploading, setUploading] = useState(false);

  // Action: Requests photo library permissions and triggers ImagePicker gallery dialog
  const handlePickImage = async () => {
    try {
      // 1. Request image picking permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload a profile picture.');
        return;
      }

      // 2. Open phone photo library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Show cropping crop tool
        aspect: [1, 1], // Lock aspect ratio to square profiles
        quality: 0.3, // Compressed to keep document size small (allows saving directly in Firestore)
        base64: true, // Request base64 image data strings
      });

      // 3. Process result if not cancelled
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          const base64Uri = `data:image/jpeg;base64,${asset.base64}`;
          handleUploadImage(base64Uri);
        } else {
          // Fallback to local image URI if base64 conversion is unavailable
          handleUploadImage(asset.uri);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  // Action: Saves base64 string directly into current user profile document in Firestore
  const handleUploadImage = async (photoUri: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setUploading(true);
    try {
      // Bypasses Firebase Storage entirely to allow working offline and bypass rules overhead
      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoUrl: photoUri,
      });
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error: any) {
      console.error('Upload photo error:', error);
      Alert.alert('Error', 'Failed to update photo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Retention and archive modal management states
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'expenses' | 'chores' | 'groceries'>('expenses');
  const [archiveExpenses, setArchiveExpenses] = useState<any[]>([]);
  const [archiveChores, setArchiveChores] = useState<any[]>([]);
  const [archiveGroceries, setArchiveGroceries] = useState<any[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  // Input tracking billing cycle day (Default: 1)
  const [billingCycleDay, setBillingCycleDay] = useState(
    (householdData?.billingCycleStartDay || 1).toString()
  );
  const [savingBillingCycle, setSavingBillingCycle] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Sync internal input state if database updates billing cycle parameter
  React.useEffect(() => {
    if (householdData?.billingCycleStartDay !== undefined) {
      setBillingCycleDay(householdData.billingCycleStartDay.toString());
    }
  }, [householdData?.billingCycleStartDay]);

  // Color tokens mapping
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const raised  = isDark ? '#181F38' : '#EEF2FF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const primary = '#6366F1';

  // Action: Validates and saves edited usernames, managing usernames lookup index documents
  const handleSave = async () => {
    const cleaned = editUsername.trim().replace(/^@+/, '');
    const lowerUsername = cleaned.toLowerCase();
    
    if (!lowerUsername || !auth.currentUser) {
      Alert.alert('Error', 'Please enter a valid username');
      return;
    }

    // Skip if username did not change
    if (profile?.username && lowerUsername === profile.username.toLowerCase()) {
      setEditing(false);
      return;
    }

    try {
      // 1. Verify username uniqueness
      const usernameSnap = await getDoc(doc(db, 'usernames', lowerUsername));
      if (usernameSnap.exists()) {
        Alert.alert('Error', 'Username is already taken.');
        return;
      }

      // 2. Perform atomic batch to claim new username, delete old lookup index, and update user profile doc
      const batch = writeBatch(db);
      batch.set(doc(db, 'usernames', lowerUsername), { uid: auth.currentUser.uid });
      if (profile?.username) {
        batch.delete(doc(db, 'usernames', profile.username.toLowerCase()));
      }
      batch.update(doc(db, 'users', auth.currentUser.uid), {
        username: lowerUsername,
      });

      await batch.commit();
      setEditing(false);
      Alert.alert('Success', 'Username updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Action: Saves billing cycle parameters and triggers historical data cleanup sweeps
  const handleSaveBillingCycle = async () => {
    const dayNum = parseInt(billingCycleDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      Alert.alert('Error', 'Please enter a day between 1 and 31.');
      return;
    }
    if (!householdId) return;
    setSavingBillingCycle(true);
    try {
      // Update starting day parameter in household document
      await updateDoc(doc(db, 'households', householdId), {
        billingCycleStartDay: dayNum,
      });
      // Purge old files/records to free up db storage space limits
      await enforceDataRetentionPolicy(householdId, dayNum);
      Alert.alert('Success', `Billing cycle updated. Main view now displays day ${dayNum} to ${dayNum} for the last 3 months.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingBillingCycle(false);
    }
  };

  // Action: Fetches and filters historical backup entries matching months 4 & 5
  const fetchArchiveData = async () => {
    if (!householdId) return;
    setLoadingArchive(true);
    try {
      const cycleStartDay = householdData?.billingCycleStartDay || 1;
      const now = getSyncedDate();
      const currentCycleStart = getCycleStartDate(now, cycleStartDay);
      
      // Active screens display the last 3 months (cutoff is 2 months before current cycle start)
      const mainStartDate = new Date(currentCycleStart);
      mainStartDate.setMonth(mainStartDate.getMonth() - 2);

      // Backup logs cover months 4 and 5 (starts 4 months before current cycle start)
      const backupStartDate = new Date(currentCycleStart);
      backupStartDate.setMonth(backupStartDate.getMonth() - 4);

      // A. Query Expenses and filter backup records
      const expSnap = await getDocs(collection(db, 'households', householdId, 'expenses'));
      const fetchedExpenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const archiveExp = fetchedExpenses.filter((item) => {
        let created: Date | null = null;
        if (item.createdAt?.toDate) {
          created = item.createdAt.toDate();
        } else if (item.createdAt) {
          created = new Date(item.createdAt);
        }
        return created ? (created >= backupStartDate && created < mainStartDate) : false;
      });
      setArchiveExpenses(archiveExp);

      // B. Query Chores and filter backup records
      const choreSnap = await getDocs(collection(db, 'households', householdId, 'chores'));
      const fetchedChores = choreSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const archiveCh = fetchedChores.filter((item) => {
        let created: Date | null = null;
        if (item.createdAt?.toDate) {
          created = item.createdAt.toDate();
        } else if (item.createdAt) {
          created = new Date(item.createdAt);
        }
        return created ? (created >= backupStartDate && created < mainStartDate) : false;
      });
      setArchiveChores(archiveCh);

      // C. Query Groceries and filter backup records
      const grocerySnap = await getDocs(collection(db, 'households', householdId, 'groceries'));
      const fetchedGroceries = grocerySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const archiveGroc = fetchedGroceries.filter((item) => {
        let created: Date | null = null;
        if (item.createdAt?.toDate) {
          created = item.createdAt.toDate();
        } else if (item.createdAt) {
          created = new Date(item.createdAt);
        }
        return created ? (created >= backupStartDate && created < mainStartDate) : false;
      });
      setArchiveGroceries(archiveGroc);

    } catch (e) {
      console.error('Error fetching archive:', e);
      Alert.alert('Error', 'Failed to retrieve backup data.');
    } finally {
      setLoadingArchive(false);
    }
  };

  // Action: Displays sign out confirm alert dialog and logs user out
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => { setHouseholdId(null); auth.signOut(); },
      },
    ]);
  };

  // Action: Prompts confirmation alert dialog and deletes user profile, usernames index locks, and Firebase Auth record
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This will permanently delete your user profile and remove you from your household. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            
            setLoadingDelete(true);
            try {
              const uid = currentUser.uid;
              const userDocRef = doc(db, 'users', uid);
              
              // 1. Remove UID from active household members list
              if (householdId) {
                const hhRef = doc(db, 'households', householdId);
                await updateDoc(hhRef, {
                  members: arrayRemove(uid)
                });
              }
              
              // 2. Delete unique username lock document to release it for other users
              if (profile?.username) {
                await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
              }
              
              // 3. Delete user document profile in Firestore
              await deleteDoc(userDocRef);
              
              // 4. Delete current Auth User account
              await currentUser.delete();
              
              Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
              setHouseholdId(null);
            } catch (error: any) {
              console.error('Delete account error:', error);
              // Handle re-authentication requirement error thrown by Firebase Auth
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication Required',
                  'For security reasons, please log out, log back in, and try deleting your account again.'
                );
              } else {
                Alert.alert('Error', error.message || 'An error occurred during account deletion.');
              }
            } finally {
              setLoadingDelete(false);
            }
          }
        }
      ]
    );
  };

  // Action: Remove current user from household and clear householdId cache
  const handleLeaveHousehold = () => {
    if (!householdId) return;

    Alert.alert(
      'Leave Household',
      `Are you sure you want to leave the household "${householdData?.name || ''}"? You will lose access to its chores, expenses, groceries, and chat history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (!currentUser) return;

              // 1. Remove user UID from household members list in Firestore
              const hhRef = doc(db, 'households', householdId);
              await updateDoc(hhRef, {
                members: arrayRemove(currentUser.uid)
              });

              // 2. Clear householdId in state & AsyncStorage
              setHouseholdId(null);
              
              Alert.alert('Left Household', `You have successfully left "${householdData?.name || ''}".`);
            } catch (e: any) {
              console.error('Leave household error:', e);
              Alert.alert('Error', e.message || 'Could not leave the household. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Action: Permanently delete the household document and clear householdId settings for all members
  const handleDeleteHousehold = () => {
    if (!householdId) return;

    Alert.alert(
      'Delete Household',
      `Are you absolutely sure you want to permanently delete the household "${householdData?.name || ''}"? This will remove all members and delete all associated data (chores, expenses, groceries, messages). This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setLoadingDelete(true);
            try {
              const memberUids = householdData?.members || [];
              const batch = writeBatch(db);
              
              // 1. Clear householdId parameter for all members
              memberUids.forEach((uid: string) => {
                batch.update(doc(db, 'users', uid), {
                  householdId: null
                });
              });
              
              // 2. Delete the household document
              batch.delete(doc(db, 'households', householdId));
              
              await batch.commit();

              // 3. Update local state
              setHouseholdId(null);
              Alert.alert('Household Deleted', `"${householdData?.name || ''}" has been successfully deleted.`);
            } catch (e: any) {
              console.error('Delete household error:', e);
              Alert.alert('Error', e.message || 'Could not delete the household. Please try again.');
            } finally {
              setLoadingDelete(false);
            }
          }
        }
      ]
    );
  };

  // Copy code: Copies 6-character household invite code to clipboard
  const copyCode = async () => {
    await Clipboard.setStringAsync(householdData?.inviteCode || '');
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {/* Custom Header with Back Button and Logout Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Go Back button */}
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
        {/* Logout button */}
        <TouchableOpacity 
          onPress={handleSignOut}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#7F1D1D' : '#FECACA' }}
        >
          <MaterialIcons name="logout" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }} showsVerticalScrollIndicator={false}>

          {/* Premium Profile Header Card containing Avatar and Username editors */}
          <View style={{ backgroundColor: surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: bord, alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity onPress={handlePickImage} disabled={uploading} activeOpacity={0.8}>
              <View style={{ position: 'relative', marginBottom: 12 }}>
                <Avatar
                  name={profile?.username || user?.email || 'U'}
                  size={84}
                  bgColor={primary}
                  color="#fff"
                  photoUrl={profile?.photoUrl}
                  style={{ borderRadius: 30 }}
                />
                {/* Upload camera overlays */}
                <View style={{ position: 'absolute', bottom: -2, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: bord, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 }}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={primary} />
                  ) : (
                    <MaterialIcons name="photo-camera" size={14} color={muted} />
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Username Editing forms */}
            {editing ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <TextInput
                  value={editUsername}
                  onChangeText={setEditUsername}
                  autoCapitalize="none"
                  autoFocus
                  style={{ fontSize: 18, fontWeight: '800', color: text, borderBottomWidth: 1.5, borderColor: primary, paddingBottom: 4, width: '70%', textAlign: 'center', marginBottom: 12 }}
                  placeholderTextColor={muted}
                />
                <View style={{ flexDirection: 'row', gap: 8, width: '60%' }}>
                  <TouchableOpacity
                    onPress={() => setEditing(false)}
                    style={{ flex: 1, backgroundColor: raised, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: muted, fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    style={{ flex: 1, backgroundColor: primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setEditUsername(profile?.username ? profile.username.replace(/^@+/, '') : '');
                  setEditing(true);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ fontSize: 20, fontWeight: '900', color: text }}>
                  @{profile?.username ? profile.username.replace(/^@+/, '') : 'set_username'}
                </Text>
                <MaterialIcons name="edit" size={16} color={muted} />
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4, fontWeight: '600' }}>
              {user?.email}
            </Text>
          </View>

          {/* Household Section Container */}
          {householdData && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 }}>
                Household: {householdData.name}
              </Text>
              <View style={{ backgroundColor: surface, borderRadius: 20, borderWidth: 1, borderColor: bord, overflow: 'hidden' }}>
                
                {/* Row 1: Invite Code & Sharing handlers */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: bord }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#64748B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Invite Code
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: primary, letterSpacing: 2, marginTop: 2 }}>
                      {householdData.inviteCode}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Copy to clipboard */}
                    <TouchableOpacity
                      onPress={copyCode}
                      style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bord }}
                    >
                      <MaterialIcons name="content-copy" size={18} color={muted} />
                    </TouchableOpacity>
                    {/* Share Invitation link */}
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          const token = await createInvitation(householdData.id || householdId || '');
                          const inviteUrl = `https://shared-living-app.web.app/invite/${token}`;
                          const message = `Join my household on House Sync!\n\nUse this link to join directly:\n${inviteUrl}\n\nOr enter the invite code: ${householdData.inviteCode}`;
                          await Share.share({ message, url: inviteUrl });
                        } catch (error: any) {
                          Alert.alert("Error", error.message || "Could not generate invitation link.");
                        }
                      }}
                      style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: primary, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MaterialIcons name="share" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Row 2: Billing Cycle Config settings */}
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: bord }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#64748B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Billing Cycle Start Day
                  </Text>
                  {/* Allow edit only if current user is household creator/owner */}
                  {householdData.createdBy === auth.currentUser?.uid ? (
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <TextInput
                        value={billingCycleDay}
                        onChangeText={setBillingCycleDay}
                        keyboardType="numeric"
                        maxLength={2}
                        style={{
                          flex: 1,
                          backgroundColor: raised,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 14,
                          fontWeight: '700',
                          color: text,
                          borderWidth: 1,
                          borderColor: bord
                        }}
                        placeholder="e.g. 10"
                        placeholderTextColor={muted}
                      />
                      <TouchableOpacity
                        onPress={handleSaveBillingCycle}
                        disabled={savingBillingCycle}
                        style={{
                          backgroundColor: primary,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 9,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {savingBillingCycle ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>
                      Starts on Day {householdData.billingCycleStartDay || 1} (Configured by Owner)
                    </Text>
                  )}
                </View>

                {/* Row 3: Backup & Archives button */}
                <TouchableOpacity
                  onPress={() => {
                    fetchArchiveData();
                    setIsArchiveModalVisible(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: bord }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="archive" size={18} color={primary} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>
                        View Archived Data
                      </Text>
                      <Text style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.4)' : '#64748B', marginTop: 1 }}>
                        Backup logs for Months 4 & 5
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={muted} />
                </TouchableOpacity>

                {/* Row 4: Leave or Delete Household triggers */}
                {householdData.createdBy === auth.currentUser?.uid ? (
                  <TouchableOpacity
                    onPress={handleDeleteHousehold}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#3B1219' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="delete-forever" size={18} color="#EF4444" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>
                        Delete Household
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#EF4444" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleLeaveHousehold}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#3B1219' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                        <MaterialIcons name="exit-to-app" size={18} color="#EF4444" />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>
                        Leave Household
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}

              </View>
            </View>
          )}

          {/* Preferences Section */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 }}>
              App Preferences
            </Text>
            <View style={{ backgroundColor: surface, borderRadius: 20, borderWidth: 1, borderColor: bord, overflow: 'hidden' }}>
              
              {/* Theme Toggle Row */}
              <TouchableOpacity
                onPress={toggleTheme}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: bord }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={18} color={primary} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>
                    {isDark ? 'Dark Theme' : 'Light Theme'}
                  </Text>
                </View>
                <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? primary : raised, justifyContent: 'center', paddingHorizontal: 2 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start', elevation: 2 }} />
                </View>
              </TouchableOpacity>

              {/* Privacy Policy Web Link Row */}
              <TouchableOpacity
                onPress={() => {
                  WebBrowser.openBrowserAsync('https://jeevan0714.github.io/shared-living/privacy-policy.html');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="security" size={18} color={primary} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>
                    Privacy Policy
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={muted} />
              </TouchableOpacity>

            </View>
          </View>

          {/* Danger Zone Section */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 }}>
              Danger Zone
            </Text>
            <View style={{ backgroundColor: surface, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#5A1A24' : '#FECACA', overflow: 'hidden' }}>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={loadingDelete}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? '#3B1219' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                    {loadingDelete ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <MaterialIcons name="delete-forever" size={18} color="#EF4444" />
                    )}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>
                    Delete Account Permanently
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Backup & Archives SlideModal */}
      <SlideModal
        visible={isArchiveModalVisible}
        onClose={() => setIsArchiveModalVisible(false)}
        title="Backup & Archives"
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 13, color: muted, marginBottom: 16 }}>
            Viewing backup records for months 4 and 5 based on the billing cycle start day. Active screens only display the last 3 months.
          </Text>

          {/* Tabs control */}
          <View style={{ flexDirection: 'row', backgroundColor: raised, borderRadius: 16, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: bord }}>
            {(['expenses', 'chores', 'groceries'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => setArchiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: archiveTab === tab ? primary : 'transparent'
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: archiveTab === tab ? '#fff' : muted, textTransform: 'capitalize' }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingArchive ? (
            <View style={{ paddingVertical: 40, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {/* archived expenses tab content */}
              {archiveTab === 'expenses' && (
                archiveExpenses.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: text, marginVertical: 20 }}>No archived expenses found.</Text>
                ) : (
                  archiveExpenses.map((item) => (
                    <View key={item.id} style={{ backgroundColor: raised, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: bord }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{item.title}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: primary, marginTop: 4 }}>₹{item.amount}</Text>
                      <Text style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                        Paid by {item.payerName || 'Member'}
                      </Text>
                    </View>
                  ))
                )
              )}

              {/* archived chores tab content */}
              {archiveTab === 'chores' && (
                archiveChores.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: text, marginVertical: 20 }}>No archived chores found.</Text>
                ) : (
                  archiveChores.map((item) => (
                    <View key={item.id} style={{ backgroundColor: raised, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: bord, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{item.title}</Text>
                        <Text style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                          Scheduled for: {item.day}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: item.done ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ color: item.done ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 'bold' }}>
                          {item.done ? 'Done' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  ))
                )
              )}

              {/* archived groceries tab content */}
              {archiveTab === 'groceries' && (
                archiveGroceries.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: text, marginVertical: 20 }}>No archived grocery items found.</Text>
                ) : (
                  archiveGroceries.map((item) => (
                    <View key={item.id} style={{ backgroundColor: raised, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: bord, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                          Qty: {item.qty || '1'} · Price: ₹{item.price || '0'}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: item.done ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ color: item.done ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 'bold' }}>
                          {item.done ? 'Bought' : 'On List'}
                        </Text>
                      </View>
                    </View>
                  ))
                )
              )}
            </ScrollView>
          )}
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
