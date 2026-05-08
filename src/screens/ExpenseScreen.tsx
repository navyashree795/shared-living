import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, Switch, Modal, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import SwipeableRow from '../components/SwipeableRow';
import { ExpenseSkeleton } from '../components/Skeleton';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { detectCategory, getCategoryIcon } from '../utils/expenseUtils';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Expense } from '../types';

type Props = { navigation: any; route?: any };

export default function ExpenseScreen({ navigation }: Props) {
  const { householdId, members, getMemberName } = useHousehold();
  const hid = householdId ?? '';
  const { isDark } = useTheme();
  const bg      = isDark ? '#0F172A' : '#F8FAFC';
  const surface = isDark ? '#1E293B' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? '#94A3B8' : '#64748B';
  const bord    = isDark ? '#334155' : '#E2E8F0';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { showToast } = useToast();
  const { profile: userData } = useUser();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  
  // Splitting state
  const [selectedMembers, setSelectedMembers] = useState<Record<string, boolean>>({});

  // Settling state
  const [settleAmount, setSettleAmount] = useState('');
  const [settleWithUid, setSettleWithUid] = useState<string | null>(null);

  const expenseInputRef = useRef<TextInput>(null);
  const settleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isModalVisible) {
      setTimeout(() => {
        expenseInputRef.current?.focus();
      }, 250);
    }
  }, [isModalVisible]);

  useEffect(() => {
    if (isSettleModalVisible) {
      setTimeout(() => {
        settleInputRef.current?.focus();
      }, 250);
    }
  }, [isSettleModalVisible]);

  useEffect(() => {
    // Select everyone by default
    const initialSelection: Record<string, boolean> = {};
    members.forEach(uid => initialSelection[uid] = true);
    setSelectedMembers(initialSelection);
  }, [members, isModalVisible]);

  useEffect(() => {
    if (!hid) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'households', hid, 'expenses'),
      orderBy('createdAt', 'desc')
    );
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
      Alert.alert('Error', 'Please select at least one person to split with.');
      return;
    }

    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const currentUserName = userData?.username ? `@${userData.username}` : (auth.currentUser?.email?.split('@')[0] || 'Member');
    const category = detectCategory(title.trim());

    try {
      await addDoc(collection(db, 'households', hid, 'expenses'), {
        type: 'expense',
        title: title.trim(),
        amount: parsed,
        category,
        paidByUid: currentUid,
        payerName: getMemberName(currentUid), 
        splitAmong: splitAmongUids,
        createdAt: serverTimestamp(),
      });
      logActivity(hid, 'expense_add', title.trim(), currentUserName, parsed);
      showToast('Expense logged', 'success');
      setTitle(''); setAmount('');
      setIsModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not add expense.');
    }
  };

  const handleAddSettlement = async () => {
    const parsed = parseFloat(settleAmount);
    if (isNaN(parsed) || parsed <= 0 || !settleWithUid) {
      Alert.alert('Error', 'Please select a person and enter a valid amount.');
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
      setSettleAmount('');
      setSettleWithUid(null);
      setIsSettleModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not record settlement.');
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'households', hid, 'expenses', id));
            showToast('Transaction removed', 'success');
          } catch {
            Alert.alert('Error', 'Could not delete expense.');
          }
        } 
      }
    ]);
  }, [householdId]);

  // -------------------------------------------------------------
  // Directed Calculation Engine
  // -------------------------------------------------------------
  const { totalHouseholdSpent, peerBalances } = useMemo(() => {
    const currentUid = auth.currentUser?.uid || '';
    let totalHouseholdSpent = 0;
    
    // balances[otherUid] indicates how much *currentUid* owes *otherUid* (positive = owe them, negative = they owe me)
    const peerBalances: Record<string, number> = {};
    members.forEach(uid => { if (uid !== currentUid) peerBalances[uid] = 0; });

    expenses.forEach(exp => {
      if (exp.type === 'expense' && exp.amount) {
        totalHouseholdSpent += exp.amount;
        
        if (exp.splitAmong && exp.splitAmong.length > 0 && exp.paidByUid) {
          const share = exp.amount / exp.splitAmong.length;
          
          exp.splitAmong.forEach(splitUid => {
            if (splitUid !== exp.paidByUid) { // You don't owe yourself
              if (splitUid === currentUid) {
                // I owe the payer
                peerBalances[exp.paidByUid!] = (peerBalances[exp.paidByUid!] || 0) + share;
              } else if (exp.paidByUid === currentUid) {
                // Payer is me, so someone else owes me (negative value in peerBalances means they owe me)
                peerBalances[splitUid] = (peerBalances[splitUid] || 0) - share;
              }
            }
          });
        }
      } else if (exp.type === 'payment' && exp.amount && exp.fromPaidUid && exp.toReceivedUid) {
        if (exp.fromPaidUid === currentUid) {
          // I paid someone -> my debt to them decreases
          peerBalances[exp.toReceivedUid] = (peerBalances[exp.toReceivedUid] || 0) - exp.amount;
        } else if (exp.toReceivedUid === currentUid) {
          // Someone paid me -> their debt to me decreases (which means my "negative debt" becomes more positive towards 0)
          peerBalances[exp.fromPaidUid] = (peerBalances[exp.fromPaidUid] || 0) + exp.amount;
        }
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
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
               <MaterialIcons name="done" size={20} color="#6366F1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F1F5F9' : '#0F172A' }}>{primaryText}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>Settlement</Text>
            </View>
            <View style={{ alignItems: 'flex-end', paddingLeft: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#6366F1' }}>
                ₹{item.amount.toFixed(2)}
              </Text>
            </View>
          </View>
        </SwipeableRow>
      );
    }
    
    // Expense Rendering
    const iconName = getCategoryIcon(item.category);
    const splitCount = item.splitAmong?.length || 1;
    const individualShare = item.amount / splitCount;
    const iPaid = item.paidByUid === currentUid;
    const amIInvolved = Boolean(item.splitAmong?.includes(currentUid!));

    let relationshipText = '';
    let relationshipColor = isDark ? '#94A3B8' : '#64748B';

    if (iPaid) {
      if (splitCount > 1) {
        relationshipText = `You lent ₹${(item.amount - individualShare).toFixed(2)}`;
        relationshipColor = '#10B981'; // text-success
      } else {
        relationshipText = `You paid for yourself`;
      }
    } else if (amIInvolved) {
      relationshipText = `You owe ₹${individualShare.toFixed(2)}`;
      relationshipColor = '#EF4444'; // text-danger
    } else {
      relationshipText = `Not involved`;
      relationshipColor = isDark ? '#94A3B8' : '#64748B';
    }

    return (
      <SwipeableRow onDelete={() => handleDelete(item.id)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#0F172A' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
             <MaterialIcons name={iconName} size={20} color={isDark ? '#94A3B8' : '#64748B'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#F1F5F9' : '#0F172A' }}>{item.title}</Text>
            <Text style={{ fontSize: 12, fontWeight: '500', color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
              Paid by {iPaid ? 'You' : getMemberName(item.paidByUid!)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingLeft: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#F1F5F9' : '#0F172A', marginBottom: 4 }}>
              ₹{item.amount.toFixed(2)}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: relationshipColor }}>
              {relationshipText}
            </Text>
          </View>
        </View>
      </SwipeableRow>
    );
  }, [getMemberName, handleDelete]);

  const renderHeader = () => (
    <>
      {/* Total Spending Card */}
      <View style={{ backgroundColor: '#6366F1', borderRadius: 24, padding: 24, marginBottom: 16, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Household Spending</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>₹{totalHouseholdSpent.toFixed(2)}</Text>
      </View>

      {/* Action Button */}
      <TouchableOpacity 
        onPress={() => setIsSettleModalVisible(true)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}
      >
        <MaterialIcons name="account-balance-wallet" size={20} color="#6366F1" />
        <Text style={{ color: '#6366F1', fontWeight: '800', marginLeft: 8, fontSize: 15 }}>Settle Up</Text>
      </TouchableOpacity>

      {/* Directed Liabilities Dashboard */}
      <View style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' }}>
        <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Your Balances</Text>
        
        {Object.entries(peerBalances).filter(([_, amount]) => Math.abs(amount) > 0.01).length === 0 ? (
          <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 14, fontWeight: '600', paddingVertical: 8 }}>You are all settled up! 🎉</Text>
        ) : (
          Object.entries(peerBalances).map(([uid, amount]) => {
            if (Math.abs(amount) < 0.01) return null; // Ignore floats close to 0

            const isOwedToMe = amount < 0; // If I owe them a negative amount, they owe me.
            const absAmount = Math.abs(amount).toFixed(2);
            
            return (
              <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: isOwedToMe ? (isDark ? '#064E3B' : '#D1FAE5') : (isDark ? '#7F1D1D' : '#FEE2E2') }}>
                    <MaterialIcons name={isOwedToMe ? "arrow-downward" : "arrow-upward"} size={16} color={isOwedToMe ? "#10B981" : "#EF4444"} />
                  </View>
                  <Text style={{ color: isDark ? '#F1F5F9' : '#0F172A', fontSize: 14, fontWeight: '700' }}>
                    {isOwedToMe ? `${getMemberName(uid)} owes you` : `You owe ${getMemberName(uid)}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isOwedToMe ? '#10B981' : '#EF4444' }}>
                  ₹{absAmount}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }}>Transactions</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScreenHeader 
        navigation={navigation as any} 
        title="Expenses" 
        rightIcon="add" 
        onRightPress={() => setIsModalVisible(true)} 
      />

      <FlatList
        className="flex-1"
        data={expenses}
        keyExtractor={item => item.id}
        renderItem={renderExpense}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading && expenses.length === 0 ? (
            <View className="px-6">
              <EmptyState 
                icon="receipt-long" 
                title="No expenses yet" 
                description="Add a shared expense to split it automatically."
              />
            </View>
          ) : loading ? (
            <View className="px-6">
              {[1, 2, 3, 4, 5].map((i) => <ExpenseSkeleton key={i} />)}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Expense Minimalist Modal */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View className="flex-1 bg-black/50 justify-center px-6">
            
            {!showSplitOptions && <Text className="text-white text-2xl font-black mb-4 ml-2 shadow-sm">Add new expense</Text>}

            <View className="bg-surface rounded-[32px] p-6 shadow-xl relative overflow-hidden">
              { !showSplitOptions ? (
                <View>
                  <Text className="text-textMuted text-xs font-bold mb-1">Enter expense name</Text>
                  <TextInput
                    ref={expenseInputRef}
                    className="text-textMain text-lg font-bold border-b border-border/60 pb-2 mb-8"
                    placeholder="e.g. Swiggy, Uber"
                    placeholderTextColor="#D1D5DB"
                    value={title}
                    onChangeText={setTitle}
                  />

                  <View className="border-b border-border/60 pb-2 mb-8 mt-2">
                    <Text className="text-textMuted text-xs font-bold mb-1">Total Amount</Text>
                    <View className="flex-row items-center mt-1">
                       <Text className="text-textMain text-2xl font-black mr-2">₹</Text>
                       <TextInput
                         className="flex-1 text-textMain text-2xl font-black"
                         placeholder="0.00"
                         placeholderTextColor="#D1D5DB"
                         keyboardType="decimal-pad"
                         value={amount}
                         onChangeText={setAmount}
                       />
                    </View>
                  </View>

                  <TouchableOpacity 
                    onPress={() => setShowSplitOptions(true)}
                    className="bg-secondary/30 rounded-2xl py-3.5 items-center border border-border/50 mb-6"
                  >
                    <Text className="text-textMain font-bold text-sm">Split: {Object.values(selectedMembers).filter(Boolean).length === members.length ? 'Everyone' : 'Custom'} (Edit)</Text>
                  </TouchableOpacity>

                  <View className="flex-row justify-between mt-2">
                    <TouchableOpacity 
                      className="flex-1 bg-background py-3.5 rounded-2xl items-center mr-3 border border-border/40"
                      onPress={() => { setIsModalVisible(false); setShowSplitOptions(false); setTitle(''); setAmount(''); }}
                    >
                      <Text className="text-textMuted font-bold text-sm">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      className="flex-1 bg-textMain py-3.5 rounded-2xl items-center"
                      onPress={() => { setShowSplitOptions(false); handleAddExpense(); }}
                    >
                      <Text className="text-white font-bold text-sm">Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-textMain text-lg font-black">Split among</Text>
                    <TouchableOpacity onPress={() => setShowSplitOptions(false)} className="bg-primary/10 px-3 py-1.5 rounded-full">
                       <Text className="text-primary font-bold text-xs uppercase">Done</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View className="flex-row items-center justify-between mb-4 border-b border-border pb-3">
                    <Text className="text-textMuted text-xs font-bold">Select / Deselect</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        const allSelected = members.every(m => selectedMembers[m]);
                        const nextState: Record<string, boolean> = {};
                        members.forEach(m => nextState[m] = !allSelected);
                        setSelectedMembers(nextState);
                      }}
                    >
                      <Text className="text-primary text-[10px] font-bold uppercase">{members.every(m => selectedMembers[m]) ? 'Deselect All' : 'Select All'}</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                    {members.map(uid => (
                      <View key={uid} className="flex-row items-center justify-between mb-3 last:mb-0">
                        <Text className="text-textMain font-bold text-base">{getMemberName(uid)}</Text>
                        <Switch 
                          value={selectedMembers[uid] || false}
                          onValueChange={(val) => setSelectedMembers(prev => ({...prev, [uid]: val}))}
                          trackColor={{ false: "#E5E7EB", true: "#4F46E5" }}
                          thumbColor="#fff"
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settle Up Modal */}
      <SlideModal
        visible={isSettleModalVisible}
        onClose={() => setIsSettleModalVisible(false)}
        title="Settle Up"
      >
        <View>
          <Text className="text-textMuted text-[10px] font-bold uppercase tracking-widest mb-2 border-t border-border/60 pt-4 mt-2">Who are you paying?</Text>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={true} className="mb-6 border-b border-border/60 pb-4">
            {members.filter(uid => uid !== auth.currentUser?.uid).map(uid => {
              // Show how much you owe them specifically
               const oweThem = peerBalances[uid] > 0 ? peerBalances[uid] : 0;
               return (
                <TouchableOpacity 
                  key={uid}
                  onPress={() => setSettleWithUid(uid)}
                  className={`flex-row items-center justify-between p-3 mb-2 rounded-xl border ${settleWithUid === uid ? 'bg-primary/5 border-primary' : 'bg-background border-border/50'}`}
                >
                  <Text className={`font-bold ${settleWithUid === uid ? 'text-primary' : 'text-textMain'}`}>
                    {getMemberName(uid)}
                  </Text>
                  {oweThem > 0 && <Text className="text-xs font-bold text-danger">You owe ₹{oweThem.toFixed(2)}</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View className="border-b border-border/60 pb-2 mb-8 mt-2">
            <Text className="text-textMuted text-xs font-bold mb-1">Amount Paid</Text>
            <View className="flex-row items-center mt-1">
               <Text className="text-textMain text-2xl font-black mr-2">₹</Text>
               <TextInput 
                 ref={settleInputRef}
                 className="flex-1 text-textMain text-2xl font-black" 
                 placeholder="0.00" 
                 placeholderTextColor="#D1D5DB"
                 value={settleAmount} 
                 onChangeText={setSettleAmount} 
                 keyboardType="decimal-pad" 
               />
            </View>
          </View>

          <View className="flex-row justify-between mt-2 mb-2">
            <TouchableOpacity 
              className="flex-1 bg-background py-3.5 rounded-2xl items-center mr-3 border border-border/40"
              onPress={() => { setIsSettleModalVisible(false); setSettleAmount(''); setSettleWithUid(null); }}
            >
              <Text className="text-textMuted font-bold text-sm">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 bg-textMain py-3.5 rounded-2xl items-center" 
              onPress={handleAddSettlement}
            >
              <Text className="text-white font-bold text-sm">Record Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
