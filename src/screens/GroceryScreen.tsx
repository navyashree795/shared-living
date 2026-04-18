import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHouseholdMembers } from '../hooks/useHouseholdMembers';
import { detectCategory } from '../utils/expenseUtils';
import { logActivity } from '../utils/activityUtils';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, GroceryItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Grocery'>;

interface Category {
  id: string;
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  bg: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'produce', name: 'Fresh Produce', icon: 'eco', bg: '#EFFDF5', color: '#059669' },
  { id: 'dairy', name: 'Dairy & Chilled', icon: 'coffee', bg: '#F0F9FF', color: '#0284C7' },
  { id: 'meat', name: 'Meat & Seafood', icon: 'restaurant', bg: '#FFF1F2', color: '#E11D48' },
  { id: 'staples', name: 'Kitchen Staples', icon: 'bakery-dining', bg: '#FEFBE8', color: '#CA8A04' },
  { id: 'essentials', name: 'Home Essentials', icon: 'auto-awesome', bg: '#F5F3FF', color: '#7C3AED' },
  { id: 'drinks', name: 'Drinks & Spirits', icon: 'local-bar', bg: '#F1F5F9', color: '#475569' },
  { id: 'misc', name: 'Miscellaneous', icon: 'inventory', bg: '#F9FAFB', color: '#6B7280' },
];

export default function GroceryScreen({ route, navigation }: Props) {
  const { householdId, members } = route.params;
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(CATEGORIES[0].id);
  const { profile: userData } = useUser();
  const { getMemberName } = useHouseholdMembers(members);
  const [loading, setLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isAddModalVisible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [isAddModalVisible]);

  useEffect(() => {
    if (!householdId) return;
    const q = query(
      collection(db, 'households', householdId, 'groceries'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroceryItem)));
      setLoading(false);
    }, (err) => {
      console.error("Grocery fetch error:", err);
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  const estimatedCost = pending.reduce((sum, item) => sum + (item.price || 0), 0);
  const cartTotalCost = done.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleAdd = async () => {
    const name = newItem.trim();
    if (!name) return;

    const priceNum = parseFloat(newPrice) || 0;
    try {
      await addDoc(collection(db, 'households', householdId, 'groceries'), {
        name,
        done: false,
        category: selectedCategoryId,
        qty: newQty.trim(),
        price: priceNum,
        addedBy: userData?.username ? `@${userData.username}` : (auth.currentUser?.email || 'Unknown'),
        expenseLogged: false,
        createdAt: serverTimestamp(),
      });
      logActivity(householdId, 'grocery_add', name);
      setNewItem(''); setNewQty(''); setNewPrice('');
      setIsAddModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not add item.');
    }
  };

  const handleToggle = async (item: GroceryItem) => {
    try {
      const isFinishing = !item.done;
      await updateDoc(doc(db, 'households', householdId, 'groceries', item.id), {
        done: isFinishing,
      });
      if (isFinishing) {
        logActivity(householdId, 'grocery_done', item.name);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not update item.');
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'households', householdId, 'groceries', itemId));
    } catch (e) {
      Alert.alert('Error', 'Could not delete item.');
    }
  };

  const handleClearCompleted = () => {
    if (done.length === 0) return;
    
    Alert.alert('Clear Cart', 'Are you sure you want to remove all bought items from the list?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear', 
        style: 'destructive',
        onPress: async () => {
          try {
            const batch = writeBatch(db);
            done.forEach(item => {
              const ref = doc(db, 'households', householdId, 'groceries', item.id);
              batch.delete(ref);
            });
            await batch.commit();
          } catch (e) {
            Alert.alert('Error', 'Could not clear list.');
          }
        }
      }
    ]);
  };

  const handleLogToExpenses = async (item: GroceryItem) => {
    if (!item.price || item.price <= 0) return;

    Alert.alert(
      'Log to Expenses',
      `Add an expense of ₹${item.price} for ${item.name}? This will be split among all members evenly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Event', 
          style: 'default',
          onPress: async () => {
            const currentUid = auth.currentUser?.uid;
            if (!currentUid) return;

            try {
              // 1. Add Expense
              const categoryMatch = detectCategory(item.name);
              await addDoc(collection(db, 'households', householdId, 'expenses'), {
                type: 'expense',
                title: `Groceries: ${item.name}`,
                amount: item.price,
                category: categoryMatch,
                paidByUid: currentUid,
                payerName: getMemberName(currentUid), 
                splitAmong: members, // Split among everyone by default
                createdAt: serverTimestamp(),
              });

              // 2. Mark Grocery item as logged so the button disappears
              await updateDoc(doc(db, 'households', householdId, 'groceries', item.id), {
                expenseLogged: true,
              });

              Alert.alert('Success', 'Successfully integrated into Household Expenses.');
            } catch (e) {
              Alert.alert('Error', 'Could not log to expenses.');
            }
          }
        }
      ]
    );
  };

  // Convert flat data into sectioned data for FlatList
  const listData: Array<any> = [];
  
  if (pending.length > 0) {
    listData.push({ type: 'header', title: 'ON THE LIST', color: 'text-warning' });
    pending.forEach(item => listData.push({ type: 'item', data: item }));
  }

  if (done.length > 0) {
    listData.push({ type: 'header_completed', title: 'IN THE CART', color: 'text-success' });
    done.forEach(item => listData.push({ type: 'item', data: item }));
  }

  const renderRow = ({ item }: { item: any }) => {
    if (item.type === 'header') {
      return <Text className={`text-xs font-black tracking-widest pl-1 mb-2 mt-4 text-[#D97706]`}>{item.title}</Text>;
    }
    
    if (item.type === 'header_completed') {
      return (
        <View className="flex-row items-center justify-between mt-8 mb-2">
          <Text className={`text-xs font-black tracking-widest pl-1 text-[#10B981]`}>{item.title}</Text>
          <TouchableOpacity onPress={handleClearCompleted} className="flex-row items-center bg-danger/10 px-3 py-1.5 rounded-full border border-danger/20">
            <MaterialIcons name="delete-sweep" size={14} color="#EF4444" />
            <Text className="text-[10px] font-bold text-danger ml-1 uppercase">Clear All</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const groceryItem: GroceryItem = item.data;
    const category = CATEGORIES.find(c => c.id === groceryItem.category) || CATEGORIES[CATEGORIES.length - 1];
    
    return (
      <View className="flex-col bg-white rounded-[24px] p-4 mb-3 border border-border shadow-sm">
        <View className="flex-row items-center">
          <TouchableOpacity className="mr-3" onPress={() => handleToggle(groceryItem)}>
            <MaterialIcons 
              name={groceryItem.done ? "check-circle" : "radio-button-unchecked"} 
              size={28} 
              color={groceryItem.done ? "#10B981" : "#9CA3AF"} 
            />
          </TouchableOpacity>
          
          <View style={{ backgroundColor: category.bg }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
            <MaterialIcons name={category.icon} size={20} color={category.color} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-baseline">
              <Text className={`text-base font-bold ${groceryItem.done ? 'text-textMuted line-through' : 'text-textMain'}`}>
                {groceryItem.name}
              </Text>
              {groceryItem.qty ? <Text className="text-primary text-[11px] font-black ml-2 uppercase tracking-tight">{groceryItem.qty}</Text> : null}
            </View>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-[10px] text-textMuted font-bold uppercase tracking-widest mr-2">{category.name}</Text>
              {groceryItem.price > 0 && (
                <Text className="text-[10px] text-textMuted font-bold uppercase">·  ₹{groceryItem.price.toFixed(2)}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={() => handleDelete(groceryItem.id)} className="p-2 ml-1">
            <MaterialIcons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Expense Logging Section for Completed Items */}
        {groceryItem.done && groceryItem.price > 0 && !groceryItem.expenseLogged && (
          <View className="mt-3 pt-3 border-t border-border/50 flex-row items-center justify-between">
            <Text className="text-xs text-textMuted font-medium pr-4">You bought this for <Text className="font-bold text-textMain">₹{groceryItem.price}</Text>. Log it to your household expenses?</Text>
            <TouchableOpacity 
              onPress={() => handleLogToExpenses(groceryItem)}
              className="bg-primary px-3 py-2 rounded-xl flex-row items-center shadow-sm"
            >
              <MaterialIcons name="account-balance-wallet" size={14} color="#FFF" />
              <Text className="text-white text-[10px] font-bold ml-1.5 uppercase tracking-wider">Log</Text>
            </TouchableOpacity>
          </View>
        )}
        {groceryItem.done && groceryItem.expenseLogged && (
          <View className="mt-3 pt-3 border-t border-border/50 flex-row items-center">
             <MaterialIcons name="verified" size={14} color="#10B981" />
             <Text className="text-xs text-success font-bold ml-1">Logged to Expenses</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader 
        navigation={navigation as any} 
        title="Grocery"
        rightIcon="add"
        onRightPress={() => setIsAddModalVisible(true)}
      />

      <View className="flex-row mx-6 mb-2 gap-3">
        <View className="flex-1 bg-white border border-border p-4 rounded-2xl shadow-sm items-center">
          <Text className="text-textMuted text-[10px] uppercase font-bold tracking-widest mb-1">To Spend</Text>
          <Text className="text-2xl font-black text-warning">₹{estimatedCost.toFixed(0)}</Text>
        </View>
        <View className="flex-1 bg-white border border-border p-4 rounded-2xl shadow-sm items-center">
          <Text className="text-textMuted text-[10px] uppercase font-bold tracking-widest mb-1">In Cart Cost</Text>
          <Text className="text-2xl font-black text-success">₹{cartTotalCost.toFixed(0)}</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={listData}
          keyExtractor={(i, index) => i.type === 'item' ? i.data.id : `header_${index}`}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState 
              icon="shopping-cart" 
              title="Your list is empty!" 
              description="Add your first item below so your roommates know what to buy."
            />
          }
        />
      )}

      <SlideModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        title="Add Item"
      >
        <View className="pb-2 pt-2">
          <Text className="text-textMuted text-xs font-bold tracking-widest px-6 mb-3">SELECT CATEGORY</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map(cat => {
              const isActive = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 24,
                    marginRight: 12,
                    borderWidth: 1,
                    borderColor: isActive ? '#4F46E5' : '#E5E7EB',
                    backgroundColor: isActive ? '#4F46E5' : '#FFFFFF',
                  }}
                >
                  <MaterialIcons 
                    name={cat.icon} 
                    size={14} 
                    color={isActive ? '#FFF' : '#6B7280'} 
                  />
                  <Text style={{
                    marginLeft: 8,
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: isActive ? '#FFFFFF' : '#6B7280',
                  }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View className="px-2 pb-4 mt-2">
            <View className="border-b border-border/60 pb-2 mb-6">
              <Text className="text-textMuted text-xs font-bold mb-1">Item Name</Text>
              <TextInput
                ref={inputRef}
                className="text-textMain text-lg font-bold"
                placeholder="e.g. Milk, Bread"
                placeholderTextColor="#D1D5DB"
                value={newItem}
                onChangeText={setNewItem}
              />
            </View>
            
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1 border-b border-border/60 pb-2">
                <Text className="text-textMuted text-xs font-bold mb-1">Quantity</Text>
                <TextInput
                  className="text-textMain text-base font-bold"
                  placeholder="e.g. 2kg"
                  placeholderTextColor="#D1D5DB"
                  value={newQty}
                  onChangeText={setNewQty}
                />
              </View>
              <View className="flex-1 border-b border-border/60 pb-2">
                <Text className="text-textMuted text-xs font-bold mb-1">Price</Text>
                <View className="flex-row items-center mt-1">
                  <Text className="text-textMain text-lg font-black mr-2">₹</Text>
                  <TextInput
                    className="flex-1 text-textMain text-lg font-bold"
                    placeholder="0.00"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    value={newPrice}
                    onChangeText={setNewPrice}
                  />
                </View>
              </View>
            </View>

            <View className="flex-row justify-between mt-4">
              <TouchableOpacity 
                className="flex-1 bg-background py-3.5 rounded-2xl items-center mr-3 border border-border/40"
                onPress={() => { setIsAddModalVisible(false); setNewItem(''); setNewPrice(''); setNewQty(''); }}
              >
                <Text className="text-textMuted font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-textMain py-3.5 rounded-2xl items-center" 
                onPress={handleAdd}
              >
                <Text className="text-white font-bold text-sm">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
