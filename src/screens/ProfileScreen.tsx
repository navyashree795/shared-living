import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseConfig';
import { doc, updateDoc, collection, getDocs, deleteDoc, arrayRemove } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from '../components/Avatar';
import { getSyncedDate } from '../utils/timeUtils';
import { getCycleStartDate, enforceDataRetentionPolicy } from '../utils/retentionUtils';
import SlideModal from '../components/SlideModal';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, profile } = useUser();
  const { householdId, householdData, setHouseholdId } = useHousehold();
  const { isDark, toggleTheme } = useTheme();

  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editing, setEditing] = useState(false);

  // Retention and archive states
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'expenses' | 'chores' | 'groceries'>('expenses');
  const [archiveExpenses, setArchiveExpenses] = useState<any[]>([]);
  const [archiveChores, setArchiveChores] = useState<any[]>([]);
  const [archiveGroceries, setArchiveGroceries] = useState<any[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [billingCycleDay, setBillingCycleDay] = useState(
    (householdData?.billingCycleStartDay || 1).toString()
  );
  const [savingBillingCycle, setSavingBillingCycle] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  React.useEffect(() => {
    if (householdData?.billingCycleStartDay !== undefined) {
      setBillingCycleDay(householdData.billingCycleStartDay.toString());
    }
  }, [householdData?.billingCycleStartDay]);

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

  const handleSaveBillingCycle = async () => {
    const dayNum = parseInt(billingCycleDay, 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      Alert.alert('Error', 'Please enter a day between 1 and 31.');
      return;
    }
    if (!householdId) return;
    setSavingBillingCycle(true);
    try {
      await updateDoc(doc(db, 'households', householdId), {
        billingCycleStartDay: dayNum,
      });
      await enforceDataRetentionPolicy(householdId, dayNum);
      Alert.alert('Success', `Billing cycle updated. Main view now displays day ${dayNum} to ${dayNum} for the last 3 months.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingBillingCycle(false);
    }
  };

  const fetchArchiveData = async () => {
    if (!householdId) return;
    setLoadingArchive(true);
    try {
      const cycleStartDay = householdData?.billingCycleStartDay || 1;
      const now = getSyncedDate();
      const currentCycleStart = getCycleStartDate(now, cycleStartDay);
      
      const mainStartDate = new Date(currentCycleStart);
      mainStartDate.setMonth(mainStartDate.getMonth() - 2);

      const backupStartDate = new Date(currentCycleStart);
      backupStartDate.setMonth(backupStartDate.getMonth() - 4);

      // Expenses archive query
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

      // Chores archive query
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

      // Groceries archive query
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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => { setHouseholdId(null); auth.signOut(); },
      },
    ]);
  };

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
              
              // 1. Remove from household if exists
              if (householdId) {
                const hhRef = doc(db, 'households', householdId);
                await updateDoc(hhRef, {
                  members: arrayRemove(uid)
                });
              }
              
              // 2. Free up the username
              if (profile?.username) {
                await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
              }
              
              // 3. Delete the user document in Firestore
              await deleteDoc(userDocRef);
              
              // 4. Delete Auth User account
              await currentUser.delete();
              
              Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
              setHouseholdId(null);
            } catch (error: any) {
              console.error('Delete account error:', error);
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
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: raised, borderRadius: 14, padding: 16, marginBottom: 16 }}
            >
              <Text style={{ fontSize: 22, fontWeight: '900', color: primary, letterSpacing: 6 }}>
                {householdData.inviteCode}
              </Text>
              <MaterialIcons name="content-copy" size={20} color={muted} />
            </TouchableOpacity>

            {/* Billing Cycle Setting */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Billing Cycle Start Day
            </Text>
            {householdData.createdBy === auth.currentUser?.uid ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <TextInput
                  value={billingCycleDay}
                  onChangeText={setBillingCycleDay}
                  keyboardType="numeric"
                  maxLength={2}
                  style={{
                    flex: 1,
                    backgroundColor: raised,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
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
                    borderRadius: 14,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  {savingBillingCycle ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ backgroundColor: raised, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: text }}>
                  Starts on Day {householdData.billingCycleStartDay || 1} of each month
                </Text>
                <Text style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                  Configured by household owner
                </Text>
              </View>
            )}

            {/* Archive section */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Backup & Retention
            </Text>
            <TouchableOpacity
              onPress={() => {
                fetchArchiveData();
                setIsArchiveModalVisible(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(99, 102, 241, 0.2)'
              }}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: text }}>
                  View Archived Data
                </Text>
                <Text style={{ fontSize: 11, color: primary, marginTop: 2 }}>
                  Months 4 & 5 backup logs
                </Text>
              </View>
              <MaterialIcons name="archive" size={22} color={primary} />
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

        {/* Legal & Compliance */}
        <View style={{ backgroundColor: surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: bord }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Legal & Compliance
          </Text>
          <TouchableOpacity
            onPress={() => {
              WebBrowser.openBrowserAsync('https://jeevan0714.github.io/shared-living/privacy-policy.html');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="security" size={20} color={primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: text }}>
                Privacy Policy
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={loadingDelete}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? '#3B1219' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                {loadingDelete ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <MaterialIcons name="delete-forever" size={20} color="#EF4444" />
                )}
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>
                Delete Account
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#EF4444" />
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

          {/* Tabs */}
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
