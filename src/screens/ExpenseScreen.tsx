import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Switch, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { logActivity } from '../utils/activityUtils';
import { detectCategory, getCategoryIcon } from '../utils/expenseUtils';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Expense } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

export default function ExpenseScreen({ route, navigation }: Props) {
  const { householdId, members = [] } = route.params || {};
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  const allInvolvedUids = Array.from(new Set([
    ...members,
    ...expenses.map(e => e.paidByUid).filter(Boolean) as string[],
    ...expenses.flatMap(e => e.splitAmong || []),
    ...expenses.map(e => e.fromPaidUid).filter(Boolean) as string[],
    ...expenses.map(e => e.toReceivedUid).filter(Boolean) as string[]
  ]));

  const householdMembers = useHouseholdMembers(allInvolvedUids);
  const getMemberName = householdMembers?.getMemberName || ((uid: string) => uid === auth.currentUser?.uid ? 'You' : 'Member');

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
    const q = query(
      collection(db, 'households', householdId, 'expenses'),
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

    const category = detectCategory(title.trim());

    try {
      await addDoc(collection(db, 'households', householdId, 'expenses'), {
        type: 'expense',
        title: title.trim(),
        amount: parsed,
        category,
        paidByUid: currentUid,
        payerName: getMemberName(currentUid), 
        splitAmong: splitAmongUids,
        createdAt: serverTimestamp(),
      });
      logActivity(householdId, 'expense_add', title.trim(), parsed);
      setTitle(''); setAmount('');
      setIsModalVisible(false);
    } catch (e) {
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

    try {
      await addDoc(collection(db, 'households', householdId, 'expenses'), {
        type: 'payment',
        amount: parsed,
        fromPaidUid: currentUid,
        toReceivedUid: settleWithUid,
        createdAt: serverTimestamp(),
      });
      logActivity(householdId, 'payment_add', `to ${getMemberName(settleWithUid)}`, parsed);
      setSettleAmount('');
      setSettleWithUid(null);
      setIsSettleModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not record settlement.');
    }
  };

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
  }, [expenses, members, auth.currentUser?.uid]);

  const renderExpense = ({ item }: { item: Expense }) => {
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
        <View className="flex-row items-center bg-secondary/20 rounded-2xl p-4 mb-3 border border-primary/20 shadow-sm">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
             <MaterialIcons name="done" size={20} color="#4F46E5" />
          </View>
          <View className="flex-1">
            <Text className="text-textMain text-base font-bold">{primaryText}</Text>
            <Text className="text-textMuted text-xs font-medium mt-1">Settlement</Text>
          </View>
          <View className="items-end pl-2">
            <Text className="text-lg font-extrabold pb-0.5 text-primary">
              ₹{item.amount.toFixed(2)}
            </Text>
          </View>
        </View>
      );
    }
    
    // Expense Rendering
    const iconName = getCategoryIcon(item.category);
    const splitCount = item.splitAmong?.length || 1;
    const individualShare = item.amount / splitCount;
    const iPaid = item.paidByUid === currentUid;
    const amIInvolved = Boolean(item.splitAmong?.includes(currentUid!));

    let relationshipText = '';
    let relationshipColorClass = 'text-textMuted';

    if (iPaid) {
      if (splitCount > 1) {
        relationshipText = `You lent ₹${(item.amount - individualShare).toFixed(2)}`;
        relationshipColorClass = 'text-success font-bold';
      } else {
        relationshipText = `You paid for yourself`;
      }
    } else if (amIInvolved) {
      relationshipText = `You owe ₹${individualShare.toFixed(2)}`;
      relationshipColorClass = 'text-danger font-bold';
    } else {
      relationshipText = `Not involved`;
    }

    return (
      <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
        <View className="w-10 h-10 rounded-full bg-secondary items-center justify-center mr-3">
           <MaterialIcons name={iconName} size={20} color="#6B7280" />
        </View>
        <View className="flex-1">
          <Text className="text-textMain text-base font-bold">{item.title}</Text>
          <Text className="text-textMuted text-xs font-medium mt-1">
            Paid by {iPaid ? 'You' : getMemberName(item.paidByUid!)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-extrabold pb-0.5 text-textMain">
            ₹{item.amount.toFixed(2)}
          </Text>
          <Text className={`text-xs ${relationshipColorClass}`}>
            {relationshipText}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader 
        navigation={navigation as any} 
        title="Expenses" 
        rightIcon="add" 
        onRightPress={() => setIsModalVisible(true)} 
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Total Spending Card */}
        <View className="mx-6 bg-primary rounded-3xl p-6 mb-4 shadow-lg shadow-primary/30">
          <Text className="text-white/80 text-sm font-bold tracking-widest mb-1 uppercase">Total Household Spending</Text>
          <Text className="text-white text-3xl font-black">₹{totalHouseholdSpent.toFixed(2)}</Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          onPress={() => setIsSettleModalVisible(true)}
          className="mx-6 flex-row items-center justify-center bg-white border border-border rounded-2xl py-3 px-4 mb-6 shadow-sm"
        >
          <MaterialIcons name="account-balance-wallet" size={20} color="#4F46E5" />
          <Text className="text-primary font-bold ml-2">Settle Up</Text>
        </TouchableOpacity>

        {/* Directed Liabilities Dashboard */}
        <View className="mx-6 bg-white rounded-3xl p-6 mb-6 shadow-sm border border-border">
          <Text className="text-textMuted text-xs font-bold tracking-widest mb-4 uppercase">Your Balances</Text>
          
          {Object.entries(peerBalances).filter(([_, amount]) => Math.abs(amount) > 0.01).length === 0 ? (
            <Text className="text-textMuted text-sm font-medium py-2">You are all settled up! 🎉</Text>
          ) : (
            Object.entries(peerBalances).map(([uid, amount]) => {
              if (Math.abs(amount) < 0.01) return null; // Ignore floats close to 0

              const isOwedToMe = amount < 0; // If I owe them a negative amount, they owe me.
              const absAmount = Math.abs(amount).toFixed(2);
              
              return (
                <View key={uid} className="flex-row items-center justify-between py-3 border-b border-border/50 last:border-0 last:pb-0">
                  <View className="flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isOwedToMe ? 'bg-success/10' : 'bg-danger/10'}`}>
                      <MaterialIcons name={isOwedToMe ? "arrow-downward" : "arrow-upward"} size={16} color={isOwedToMe ? "#10B981" : "#EF4444"} />
                    </View>
                    <Text className="text-textMain text-sm font-bold">
                      {isOwedToMe ? `${getMemberName(uid)} owes you` : `You owe ${getMemberName(uid)}`}
                    </Text>
                  </View>
                  <Text className={`text-base font-extrabold ${isOwedToMe ? 'text-success' : 'text-danger'}`}>
                    ₹{absAmount}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Transactions List */}
        <View className="px-6 pb-24">
          <Text className="text-textMuted text-xs font-bold tracking-widest mb-3 uppercase">Transactions</Text>
          {loading ? (
            <ActivityIndicator color="#4F46E5" className="mt-10" />
          ) : expenses.length === 0 ? (
            <EmptyState 
              icon="receipt-long" 
              title="No expenses yet" 
              description="Add a shared expense to split it automatically."
            />
          ) : (
            expenses.map(exp => <React.Fragment key={exp.id}>{renderExpense({item: exp})}</React.Fragment>)
          )}
        </View>
      </ScrollView>

      {/* Add Expense Minimalist Modal */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View className="flex-1 bg-black/50 justify-center px-6">
            
            {!showSplitOptions && <Text className="text-white text-2xl font-black mb-4 ml-2 shadow-sm">Add new expense</Text>}

            <View className="bg-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
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
