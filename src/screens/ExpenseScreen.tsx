import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Modal, ScrollView
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Expense } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

export default function ExpenseScreen({ route, navigation }: Props) {
  console.log("ExpenseScreen rendering, params:", route.params);
  const { householdId, members = [] } = route.params || {};
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Extract all unique UIDs involved in expenses to ensure their names are fetched
  const allInvolvedUids = Array.from(new Set([
    ...members,
    ...expenses.map(e => e.paidByUid).filter(Boolean) as string[],
    ...expenses.map(e => e.fromPaidUid).filter(Boolean) as string[],
    ...expenses.map(e => e.toReceivedUid).filter(Boolean) as string[]
  ]));

  const householdMembers = useHouseholdMembers(allInvolvedUids);
  const getMemberName = householdMembers?.getMemberName || ((uid: string) => uid === auth.currentUser?.uid ? 'You' : 'Member');

  // General States
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSettleModalVisible, setIsSettleModalVisible] = useState(false);

  // Expense States
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  // Settlement States
  const [settleAmount, setSettleAmount] = useState('');

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
    const paidByUid = auth.currentUser?.uid;
    try {
      await addDoc(collection(db, 'households', householdId, 'expenses'), {
        type: 'expense',
        title: title.trim(),
        amount: parsed,
        paidByUid,
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
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    try {
      await addDoc(collection(db, 'households', householdId, 'expenses'), {
        type: 'payment',
        amount: parsed,
        fromPaidUid: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      logActivity(householdId, 'payment_add', 'their balance', parsed);
      setSettleAmount('');
      setIsSettleModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not record settlement.');
    }
  };

  const calculateBalances = () => {
    const b: Record<string, number> = {};
    (members || []).forEach(uid => { b[uid] = 0; });
    expenses.forEach(exp => {
      if (!exp.type || exp.type === 'expense') {
        if (exp.paidByUid) {
          b[exp.paidByUid] = (b[exp.paidByUid] || 0) + exp.amount;
        }
      } else if (exp.type === 'payment') {
        if (exp.fromPaidUid) {
          b[exp.fromPaidUid] = (b[exp.fromPaidUid] || 0) - exp.amount;
        }
      }
    });
    return b;
  };

  const balances = calculateBalances();

  const renderExpense = ({ item }: { item: Expense }) => {
    const isPayment = item.type === 'payment';
    
    return (
      <View className={`flex-row items-center rounded-2xl p-4 mb-3 border shadow-sm ${isPayment ? 'bg-secondary/20 border-primary/20' : 'bg-white border-border'}`}>
        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isPayment ? 'bg-primary/20' : 'bg-secondary'}`}>
           <MaterialIcons name={isPayment ? "payment" : "receipt-long"} size={20} color={isPayment ? "#4F46E5" : "#6B7280"} />
        </View>
        <View className="flex-1">
          <Text className="text-textMain text-base font-bold">
            {isPayment ? 'Balance Settled' : `${item.title} (${getMemberName(item.paidByUid || '')})`}
          </Text>
          {isPayment && (
            <Text className="text-textMuted text-xs font-medium mt-1">
              {`${getMemberName(item.fromPaidUid || '')} settled their balance`}
            </Text>
          )}
        </View>
        <View className="items-end pl-2 border-l border-border/50">
          <Text className={`text-lg font-extrabold pb-0.5 ${isPayment ? 'text-primary' : 'text-textMain'}`}>
            ₹{item.amount.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <ScreenHeader 
        navigation={navigation as any} 
        title="Expenses" 
        rightIcon="add" 
        onRightPress={() => setIsModalVisible(true)} 
      />

      <TouchableOpacity 
        onPress={() => setIsSettleModalVisible(true)}
        className="mx-6 flex-row items-center justify-center bg-primary rounded-2xl py-3 px-4 mb-6 shadow-md shadow-primary/20"
      >
        <MaterialIcons name="done-all" size={20} color="#FFF" />
        <Text className="text-white font-bold ml-2">Settle Up Balances</Text>
      </TouchableOpacity>

      {/* Balance Summary */}
      <View className="mx-6 bg-white rounded-3xl p-6 mb-6 shadow-sm border border-border">
        <Text className="text-textMuted text-xs font-bold tracking-widest mb-4">BALANCES</Text>
        {Object.entries(balances).map(([uid, amount]) => (
          <View key={uid} className="flex-row justify-between mb-3 last:mb-0">
            <Text className="text-textMain text-sm font-bold">{getMemberName(uid)}</Text>
            <Text className={`text-base font-extrabold ${amount >= 0 ? 'text-success' : 'text-danger'}`}>
              {amount >= 0 ? '+' : ''}₹{Math.abs(amount).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#4F46E5" className="mt-10" />
      ) : (
        <FlatList
          data={expenses}
          extraData={householdMembers.memberProfiles}
          keyExtractor={i => i.id}
          renderItem={renderExpense}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ListHeaderComponent={
            expenses.length > 0 ? <Text className="text-textMuted text-xs font-bold tracking-widest mb-3 ml-1">TRANSACTIONS</Text> : null
          }
          ListEmptyComponent={
            <EmptyState 
              icon="receipt-long" 
              title="No expenses yet" 
              description="Tap the + button above to log your first shared bill."
            />
          }
        />
      )}

      {/* Add Expense Modal */}
      <SlideModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title="Add Expense"
      >
        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-sm font-bold mb-2 ml-1">What was it for?</Text>
          <TextInput 
            className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border mb-5" 
            placeholder="e.g. Groceries, Netflix" 
            placeholderTextColor="#9CA3AF"
            value={title} 
            onChangeText={setTitle} 
          />
          
          <Text className="text-textMuted text-sm font-bold mb-2 ml-1">Total Amount (₹)</Text>
          <TextInput 
            className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base font-bold border border-border" 
            placeholder="0.00" 
            placeholderTextColor="#9CA3AF"
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="decimal-pad" 
          />
        </View>

        <TouchableOpacity 
          className="bg-primary rounded-2xl py-4 items-center shadow-lg shadow-primary/30 mb-8" 
          onPress={handleAddExpense}
        >
          <Text className="text-white font-bold text-lg">Add Expense</Text>
        </TouchableOpacity>
      </SlideModal>

      {/* Settle Up Modal */}
      <SlideModal
        visible={isSettleModalVisible}
        onClose={() => setIsSettleModalVisible(false)}
        title="Settle Up"
      >
        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-sm font-bold mb-4 ml-1">Record a payment to settle your balance</Text>

          <Text className="text-textMuted text-sm font-bold mb-2 ml-1">Amount Settled (₹)</Text>
          <TextInput 
            className="bg-background rounded-xl px-4 py-4 text-textMain text-xl font-black border border-border" 
            placeholder="0" 
            placeholderTextColor="#9CA3AF"
            value={settleAmount} 
            onChangeText={setSettleAmount} 
            keyboardType="decimal-pad" 
          />
        </View>

        <TouchableOpacity 
          className="bg-success rounded-2xl py-4 items-center shadow-lg shadow-success/30 mb-8" 
          onPress={handleAddSettlement}
        >
          <Text className="text-white font-bold text-lg">Record Payment</Text>
        </TouchableOpacity>
      </SlideModal>
    </SafeAreaView>
  );
}
