import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, ScrollView, Animated, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import SlideModal from '../components/SlideModal';
import SwipeableRow from '../components/SwipeableRow';
import { ExpenseSkeleton } from '../components/Skeleton';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { detectCategory, getCategoryIcon } from '../utils/expenseUtils';
import { Expense } from '../types';

type Props = { navigation: any; route?: any };

const { width } = Dimensions.get('window');

export default function ExpenseScreen({ navigation }: Props) {
  const { householdId, members, getMemberName } = useHousehold();
  const hid = householdId ?? '';
  const { isDark } = useTheme();
  const bg      = isDark ? '#070913' : '#F4F7FF';
  const surface = isDark ? '#111827' : '#FFFFFF';
  const cardBg  = isDark ? '#1E293B' : '#FFFFFF';
  const textMain = isDark ? '#F1F5F9' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const primary = isDark ? '#818CF8' : '#4F46E5';
  const border = isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9';
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { showToast } = useToast();
  const { profile: userData } = useUser();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});
  const [settleAmount, setSettleAmount] = useState('');
  const [settleWithUid, setSettleWithUid] = useState<string | null>(null);

  const expenseInputRef = useRef<TextInput>(null);
  const settleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isModalVisible) setTimeout(() => expenseInputRef.current?.focus(), 250);
  }, [isModalVisible]);

  useEffect(() => {
    if (isSettleModalVisible) setTimeout(() => settleInputRef.current?.focus(), 250);
  }, [isSettleModalVisible]);

  useEffect(() => {
    const initialSelection: Record<string, boolean> = {};
    members.forEach(uid => initialSelection[uid] = true);
    setSelectedMembers(initialSelection);
  }, [members, isModalVisible]);

  useEffect(() => {
    if (!hid) { setLoading(false); return; }
    const q = query(collection(db, 'households', hid, 'expenses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const handleAddExpense = async () => {
    const parsed = parseFloat(amount);
    if (!title.trim() || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid title and amount.');
      return;
    }
    const splitAmongUids = Object.keys(selectedMembers).filter(uid => selectedMembers[uid]);
    if (splitAmongUids.length === 0) {
      Alert.alert('Error', 'Please select at least one person.');
      return;
    }
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const currentUserName = userData?.username ? `@${userData.username}` : (auth.currentUser?.email?.split('@')[0] || 'Member');
    try {
      await addDoc(collection(db, 'households', hid, 'expenses'), {
        type: 'expense',
        title: title.trim(),
        amount: parsed,
        category: detectCategory(title.trim()),
        paidByUid: currentUid,
        payerName: getMemberName(currentUid), 
        splitAmong: splitAmongUids,
        createdAt: serverTimestamp(),
      });
      logActivity(hid, 'expense_add', title.trim(), currentUserName, parsed);
      showToast('Expense logged', 'success');
      setTitle(''); setAmount(''); setIsModalVisible(false);
    } catch { Alert.alert('Error', 'Could not add expense.'); }
  };

  const handleAddSettlement = async () => {
    const parsed = parseFloat(settleAmount);
    if (isNaN(parsed) || parsed <= 0 || !settleWithUid) {
      Alert.alert('Error', 'Select a person and enter amount.');
      return;
    }
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const currentUserName = userData?.username ? `@${userData.username}` : (auth.currentUser?.email?.split('@')[0] || 'Member');
    try {
      await addDoc(collection(db, 'households', hid, 'expenses'), {
        type: 'payment',
        amount: parsed,
        fromPaidUid: currentUid,
        toReceivedUid: settleWithUid,
        createdAt: serverTimestamp(),
      });
      logActivity(hid, 'payment_add', `to ${getMemberName(settleWithUid)}`, currentUserName, parsed);
      showToast('Payment recorded', 'success');
      setSettleAmount(''); setSettleWithUid(null); setIsSettleModalVisible(false);
    } catch { Alert.alert('Error', 'Could not record settlement.'); }
  };

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Transaction', 'Remove this from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'households', hid, 'expenses', id));
          showToast('Deleted', 'success');
        } catch { Alert.alert('Error', 'Failed to delete.'); }
      }}
    ]);
  }, [householdId]);

  const { totalHouseholdSpent, peerBalances } = useMemo(() => {
    const currentUid = auth.currentUser?.uid || '';
    let totalHouseholdSpent = 0;
    const peerBalances: Record<string, number> = {};
    members.forEach(uid => { if (uid !== currentUid) peerBalances[uid] = 0; });

    expenses.forEach(exp => {
      if (exp.type === 'expense' && exp.amount) {
        totalHouseholdSpent += exp.amount;
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          exp.splitAmong.forEach(splitUid => {
            if (splitUid !== exp.paidByUid) {
              if (splitUid === currentUid) peerBalances[exp.paidByUid!] = (peerBalances[exp.paidByUid!] || 0) + share;
              else if (exp.paidByUid === currentUid) peerBalances[splitUid] = (peerBalances[splitUid] || 0) - share;
            }
          });
        }
      } else if (exp.type === 'payment' && exp.amount && exp.fromPaidUid && exp.toReceivedUid) {
        if (exp.fromPaidUid === currentUid) peerBalances[exp.toReceivedUid] = (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        else if (exp.toReceivedUid === currentUid) peerBalances[exp.fromPaidUid] = (peerBalances[exp.fromPaidUid] || 0) + exp.amount;
      }
    });
    return { totalHouseholdSpent, peerBalances };
  }, [expenses, members]);

  const renderExpense = useCallback(({ item }: { item: Expense }) => {
    const isPayment = item.type === 'payment';
    const currentUid = auth.currentUser?.uid;
    
    if (isPayment) {
      const isMeFrom = item.fromPaidUid === currentUid;
      const isMeTo = item.toReceivedUid === currentUid;
      const primaryText = isMeFrom 
        ? `You paid ${getMemberName(item.toReceivedUid!)}`
        : isMeTo 
          ? `${getMemberName(item.fromPaidUid!)} paid you`
          : `${getMemberName(item.fromPaidUid!)} paid ${getMemberName(item.toReceivedUid!)}`;
      
      return (
        <SwipeableRow onDelete={() => handleDelete(item.id)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 28, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.03, shadowRadius: 10, elevation: 3 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
               <MaterialIcons name="check" size={22} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: textMain }}>{primaryText}</Text>
              <Text style={{ fontSize: 10, fontWeight: '900', color: textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Settlement</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: primary }}>
              ₹{item.amount.toFixed(0)}
            </Text>
          </View>
        </SwipeableRow>
      );
    }
    
    const iconName = getCategoryIcon(item.category);
    const splitCount = item.splitAmong?.length || 1;
    const individualShare = item.amount / splitCount;
    const iPaid = item.paidByUid === currentUid;
    const amIInvolved = Boolean(item.splitAmong?.includes(currentUid!));

    let relationshipText = '';
    let relationshipColor = textMuted;

    if (iPaid) {
      relationshipText = splitCount > 1 ? `YOU LENT ₹${(item.amount - individualShare).toFixed(0)}` : `PAID FOR SELF`;
      relationshipColor = splitCount > 1 ? '#10B981' : textMuted;
    } else if (amIInvolved) {
      relationshipText = `YOU OWE ₹${individualShare.toFixed(0)}`;
      relationshipColor = '#EF4444';
    } else {
      relationshipText = `NOT INVOLVED`;
    }

    return (
      <SwipeableRow onDelete={() => handleDelete(item.id)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, borderRadius: 28, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.03, shadowRadius: 10, elevation: 3 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: isDark ? '#F8FAFC' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: isDark ? '#E2E8F0' : '#F1F5F9' }}>
             <MaterialIcons name={iconName} size={22} color="#64748B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: textMain }}>{item.title}</Text>
            <Text style={{ fontSize: 10, fontWeight: '900', color: textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              {iPaid ? 'Paid by You' : `By ${getMemberName(item.paidByUid!)}`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: textMain, marginBottom: 4 }}>
              ₹{item.amount.toFixed(0)}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '900', color: relationshipColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {relationshipText}
            </Text>
          </View>
        </View>
      </SwipeableRow>
    );
  }, [getMemberName, handleDelete, textMain, textMuted, cardBg, border, primary, isDark]);

  const renderHeader = () => (
    <View style={{ paddingHorizontal: 24 }}>
      {/* Dark Summary Card */}
      <View style={{ backgroundColor: isDark ? '#111827' : '#0F172A', borderRadius: 32, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Total Household Spending</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: -1 }}>₹{totalHouseholdSpent.toLocaleString()}</Text>
        
        <View style={{ flexDirection: 'row', marginTop: 24, justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 20 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginBottom: 6 }}>You owe</Text>
            <Text style={{ color: '#F87171', fontSize: 15, fontWeight: '900' }}>₹{Object.values(peerBalances).reduce((acc, val) => val > 0 ? acc + val : acc, 0).toLocaleString()}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: 30, alignSelf: 'center' }} />
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginBottom: 6 }}>Active balances</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>{Object.entries(peerBalances).filter(([_, val]) => Math.abs(val) > 0.01).length}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: 30, alignSelf: 'center' }} />
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginBottom: 6 }}>This month</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>{new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}</Text>
          </View>
        </View>
      </View>

      {/* Settle Up Action Button */}
      <TouchableOpacity onPress={() => setIsSettleModalVisible(true)} activeOpacity={0.8}>
        <LinearGradient
          colors={isDark ? ['#6366F1', '#4F46E5'] : ['#818CF8', '#A78BFA']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingVertical: 18, marginBottom: 32, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}
        >
          <MaterialIcons name="credit-card" size={24} color="#FFFFFF" style={{ marginRight: 12 }} />
          <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5 }}>Settle Up Now</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Your Balances Section */}
      <View style={{ marginBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
           <Text style={{ color: textMain, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>Your Balances</Text>
           <View style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ color: primary, fontSize: 9, fontWeight: '900' }}>{Object.entries(peerBalances).filter(([_, amount]) => Math.abs(amount) > 0.01).length} active</Text>
           </View>
        </View>
        
        {Object.entries(peerBalances).filter(([_, amount]) => Math.abs(amount) > 0.01).length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: cardBg, borderRadius: 24, borderWidth: 1, borderColor: border }}>
            <View style={{ backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4', padding: 12, borderRadius: 20, marginBottom: 12 }}>
               <MaterialIcons name="verified" size={32} color="#22C55E" />
            </View>
            <Text style={{ color: '#22C55E', fontSize: 14, fontWeight: '800' }}>You are all settled up! 🎉</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {Object.entries(peerBalances).map(([uid, amount]) => {
              if (Math.abs(amount) < 0.01) return null;
              const isOwedToMe = amount < 0;
              const color = isOwedToMe ? '#10B981' : '#F87171';
              const iconBg = isOwedToMe ? (isDark ? 'rgba(16,185,129,0.1)' : '#F0FDF4') : (isDark ? 'rgba(248,113,113,0.1)' : '#FEF2FF');
              const name = getMemberName(uid);
              const displayName = name.startsWith('@') ? name : `@${name.toLowerCase().replace(/\s+/g, '')}`;

              return (
                <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, padding: 12, borderRadius: 28, borderWidth: 1, borderColor: border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.04, shadowRadius: 12, elevation: 2, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 4, backgroundColor: color, borderRadius: 2 }} />
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <MaterialIcons name={isOwedToMe ? "arrow-downward" : "arrow-upward"} size={22} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMain, fontSize: 17, fontWeight: '900' }}>{displayName}</Text>
                    <Text style={{ color: color, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                      {isOwedToMe ? 'THEY OWE YOU' : 'YOU OWE THEM'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: color, marginRight: 8 }}>
                    ₹{Math.abs(amount).toLocaleString()}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>Transactions</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {/* Custom Header */}
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0.4 : 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: border }}>
          <MaterialIcons name="chevron-left" size={28} color={textMain} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '900', color: textMain }}>Expenses</Text>
        <TouchableOpacity onPress={() => setIsModalVisible(true)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: primary, alignItems: 'center', justifyContent: 'center', shadowColor: primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
          <MaterialIcons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => item.id}
        renderItem={renderExpense}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading && expenses.length === 0 ? (
            <View style={{ paddingHorizontal: 24, alignItems: 'center', marginTop: 40 }}>
              <MaterialIcons name="receipt-long" size={64} color={isDark ? '#1E293B' : '#E2E8F0'} />
              <Text style={{ color: textMuted, fontSize: 16, fontWeight: '700', marginTop: 16 }}>No transactions yet</Text>
            </View>
          ) : loading ? (
            <View style={{ paddingHorizontal: 24 }}>
              {[1, 2, 3, 4].map((i) => <ExpenseSkeleton key={i} />)}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Slide Modals */}
      <SlideModal visible={isModalVisible} onClose={() => { setIsModalVisible(false); setShowSplitOptions(false); setTitle(''); setAmount(''); }} title={showSplitOptions ? "Split Among" : "Add Expense"}>
        {!showSplitOptions ? (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={{ color: textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>Description</Text>
              <TextInput ref={expenseInputRef} style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderRadius: 20, padding: 18, color: textMain, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: border }} placeholder="What was this for?" placeholderTextColor={textMuted} value={title} onChangeText={setTitle} />
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>Amount</Text>
              <View style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderRadius: 20, paddingHorizontal: 18, height: 60, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: border }}>
                <Text style={{ color: primary, fontSize: 20, fontWeight: '900', marginRight: 10 }}>₹</Text>
                <TextInput style={{ flex: 1, color: textMain, fontSize: 22, fontWeight: '900' }} placeholder="0" placeholderTextColor={textMuted} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowSplitOptions(true)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(129,140,248,0.1)' : '#EEF2FF', padding: 16, borderRadius: 20 }}>
              <MaterialIcons name="groups" size={24} color={primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMain, fontSize: 14, fontWeight: '800' }}>Split Among</Text>
                <Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>{Object.values(selectedMembers).filter(Boolean).length === members.length ? 'Everyone' : `${Object.values(selectedMembers).filter(Boolean).length} Selected`}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddExpense}>
              <LinearGradient colors={isDark ? ['#4F46E5', '#6366F1'] : ['#4F46E5', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }}>Log Expense</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <ScrollView style={{ maxHeight: 350 }}>
              {members.map(uid => (
                <TouchableOpacity key={uid} onPress={() => setSelectedMembers(prev => ({...prev, [uid]: !prev[uid]}))} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: selectedMembers[uid] ? (isDark ? 'rgba(129,140,248,0.1)' : '#EEF2FF') : (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'), borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: selectedMembers[uid] ? primary : border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? '#0F172A' : '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <MaterialIcons name="person" size={20} color={selectedMembers[uid] ? primary : textMuted} />
                  </View>
                  <Text style={{ flex: 1, color: textMain, fontSize: 16, fontWeight: '800' }}>{getMemberName(uid)}</Text>
                  {selectedMembers[uid] && <MaterialIcons name="check-circle" size={24} color={primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowSplitOptions(false)} style={{ backgroundColor: isDark ? '#1E293B' : '#0F172A', height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </SlideModal>

      <SlideModal visible={isSettleModalVisible} onClose={() => setIsSettleModalVisible(false)} title="Settle Up">
        <View style={{ gap: 20 }}>
          <View>
            <Text style={{ color: textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Pay Someone</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              {members.filter(uid => uid !== auth.currentUser?.uid).map(uid => (
                <TouchableOpacity key={uid} onPress={() => setSettleWithUid(uid)} style={{ alignItems: 'center', marginRight: 20, padding: 12, borderRadius: 20, backgroundColor: settleWithUid === uid ? (isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF') : 'transparent', borderWidth: 1, borderColor: settleWithUid === uid ? primary : 'transparent' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: isDark ? '#0F172A' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: border }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: primary }}>{getMemberName(uid)[0]}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: textMain }}>{getMemberName(uid).split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View>
             <Text style={{ color: textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Amount Paid</Text>
             <View style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderRadius: 20, paddingHorizontal: 18, height: 60, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: border }}>
               <Text style={{ color: primary, fontSize: 20, fontWeight: '900', marginRight: 10 }}>₹</Text>
               <TextInput ref={settleInputRef} style={{ flex: 1, color: textMain, fontSize: 22, fontWeight: '900' }} placeholder="0" placeholderTextColor={textMuted} keyboardType="decimal-pad" value={settleAmount} onChangeText={setSettleAmount} />
             </View>
          </View>
          <TouchableOpacity onPress={handleAddSettlement}>
             <LinearGradient colors={['#4F46E5', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' }}>Record Payment</Text>
             </LinearGradient>
          </TouchableOpacity>
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
