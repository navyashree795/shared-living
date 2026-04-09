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
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, doc
} from 'firebase/firestore';

export default function ExpenseScreen({ route, navigation }) {
  const { householdId, members } = route.params;
  const [expenses, setExpenses] = useState([]);
  const { memberProfiles, getMemberName } = useHouseholdMembers(members);

  useEffect(() => {
    const q = query(
      collection(db, 'households', householdId, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    const allSplit = splitWith.length > 0 ? splitWith : (members || []);
    try {
      console.log(`Adding expense to households/${householdId}/expenses`);
      await addDoc(collection(db, 'households', householdId, 'expenses'), {
        title: title.trim(),
        amount: parsed,
        paidByUid,
        splitWith: allSplit,
        perPerson: parsed / allSplit.length,
        createdAt: serverTimestamp(),
      });
      setTitle(''); setAmount(''); setSplitWith([]);
      setIsModalVisible(false);
    } catch (e) {
      console.error('Expense Add Error:', e);
      Alert.alert('Error', 'Could not add expense. ' + e.message);
    }
  };

  const calculateBalances = () => {
    const balances = {};
    (members || []).forEach(uid => { balances[uid] = 0; });
    expenses.forEach(exp => {
      const share = exp.perPerson || (exp.amount / (exp.splitWith?.length || 1));
      (exp.splitWith || []).forEach(uid => {
        if (uid !== exp.paidByUid) {
          balances[uid] = (balances[uid] || 0) - share;
          balances[exp.paidByUid] = (balances[exp.paidByUid] || 0) + share;
        }
      });
    });
    return balances;
  };

  const balances = calculateBalances();

  const renderExpense = ({ item }) => (
    <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
      <View className="flex-1">
        <Text className="text-textMain text-base font-bold">{item.title}</Text>
        <Text className="text-textMuted text-xs font-medium mt-1">
          {getMemberName(item.paidByUid)} paid • split {item.splitWith?.length || 1} ways
        </Text>
      </View>
      <View className="items-end pl-2 border-l border-border/50">
        <Text className="text-textMain text-lg font-extrabold pb-0.5">
          ₹{parseFloat(item.amount).toFixed(2)}
        </Text>
        <Text className="text-textMuted text-[10px] font-bold tracking-wide">
          ₹{parseFloat(item.perPerson || 0).toFixed(2)} /EACH
        </Text>
      </View>
    </View>
  );

  const toggleSplit = (uid) => {
    setSplitWith(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <ScreenHeader 
        navigation={navigation} 
        title="Expenses" 
        rightIcon="add" 
        onRightPress={() => setIsModalVisible(true)} 
      />

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
          keyExtractor={i => i.id}
          renderItem={renderExpense}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ListHeaderComponent={
            expenses.length > 0 && <Text className="text-textMuted text-xs font-bold tracking-widest mb-3 ml-1">TRANSACTIONS</Text>
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

        <View className="bg-white rounded-3xl p-6 border border-border shadow-sm mb-6">
          <Text className="text-textMuted text-xs font-bold tracking-widest mb-4">SELECTION (TAP TO TOGGLE)</Text>
          {(members || []).map(uid => {
            const isSelected = splitWith.length === 0 || splitWith.includes(uid);
            return (
              <TouchableOpacity 
                key={uid} 
                className={`flex-row items-center p-3 rounded-xl mb-2 border ${isSelected ? 'bg-secondary/40 border-primary/30' : 'bg-background border-border'} `}
                onPress={() => toggleSplit(uid)}
              >
                <MaterialIcons
                  name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                  size={24} 
                  color={isSelected ? '#4F46E5' : '#9CA3AF'}
                />
                <Text className={`text-base font-bold ml-3 ${isSelected ? 'text-primary' : 'text-textMuted'}`}>
                  {getMemberName(uid)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          className="bg-primary rounded-2xl py-4 items-center shadow-lg shadow-primary/30 mb-8" 
          onPress={handleAddExpense}
        >
          <Text className="text-white font-bold text-lg">Split Expense</Text>
        </TouchableOpacity>
      </SlideModal>
    </SafeAreaView>
  );
}
