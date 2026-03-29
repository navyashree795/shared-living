import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Modal, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, doc
} from 'firebase/firestore';

export default function ExpenseScreen({ route, navigation }) {
  const { householdId, members } = route.params;
  const [expenses, setExpenses] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [splitWith, setSplitWith] = useState([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const profiles = {};
      for (const uid of (members || [])) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) profiles[uid] = snap.data();
        } catch {}
      }
      setMemberProfiles(profiles);
    };
    fetchProfiles();
  }, [members]);

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

  const getMemberName = (uid) => {
    if (uid === auth.currentUser?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.email?.split('@')[0] || 'Member';
  };

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
      <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 bg-white rounded-full border border-border shadow-sm">
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-extrabold text-textMain ml-4">Expenses</Text>
        <TouchableOpacity 
          className="bg-primary/10 rounded-full w-10 h-10 items-center justify-center border border-primary/20 ml-auto"
          onPress={() => setIsModalVisible(true)}
        >
          <MaterialIcons name="add" size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>

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
            <View className="items-center mt-12 bg-white p-8 rounded-3xl border border-border border-dashed">
              <View className="w-16 h-16 rounded-full bg-secondary items-center justify-center mb-4 border border-primary/10">
                <MaterialIcons name="receipt-long" size={32} color="#4F46E5" />
              </View>
              <Text className="text-textMain text-lg font-bold mb-1">No expenses yet</Text>
              <Text className="text-textMuted text-sm text-center">Tap the + button above to log your first shared bill.</Text>
            </View>
          }
        />
      )}

      {/* Add Expense Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-[32px] p-6 max-h-[90%] shadow-2xl pb-10">
            
            <View className="flex-row justify-between items-center mb-6 pt-2">
              <Text className="text-textMain text-2xl font-extrabold">Add Expense</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} className="bg-white p-2 rounded-full border border-border shadow-sm">
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              
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
              
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
