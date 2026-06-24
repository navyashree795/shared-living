import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Alert, ScrollView, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import SlideModal from '../components/SlideModal';
import SwipeableRow from '../components/SwipeableRow';
import { Skeleton } from '../components/Skeleton';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { detectCategory } from '../utils/expenseUtils';
import { logActivity } from '../utils/activityUtils';
import { sendRemotePushNotification } from '../utils/notificationUtils';
import { getSyncedDate } from '../utils/timeUtils';
import { getCycleStartDate } from '../utils/retentionUtils';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, writeBatch, where, Timestamp
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, GroceryItem } from '../types';
import GroceryItemRow, { CATEGORIES, Category } from '../components/GroceryItemRow';

type Props = { navigation: any; route?: any };


export default function GroceryScreen({ navigation }: Props) {
  const { householdId, members, getMemberName, householdData, memberProfiles } = useHousehold();
  const hid = householdId ?? '';
  const { isDark } = useTheme();
  const bg      = isDark ? '#070913' : '#F5F7FF';
  const surface = isDark ? '#0E1324' : '#FFFFFF';
  const text    = isDark ? '#F1F5F9' : '#1E1B4B';
  const muted   = isDark ? '#A78BFA' : '#4F46E5';
  const bord    = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(CATEGORIES[0].id);
  const { profile: userData } = useUser();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [loggingItem, setLoggingItem] = useState<GroceryItem | null>(null);
  const [logPrice, setLogPrice] = useState('');
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
    const hid = householdId!;
    const cycleStartDay = householdData?.billingCycleStartDay || 1;
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, cycleStartDay);
    const mainStartDate = new Date(currentCycleStart);
    mainStartDate.setMonth(mainStartDate.getMonth() - 2);

    const q = query(
      collection(db, 'households', hid, 'groceries'),
      where('createdAt', '>=', Timestamp.fromDate(mainStartDate)),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as GroceryItem));
      setItems(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Grocery fetch error:", err);
      setLoading(false);
    });
    return unsub;
  }, [householdId, householdData?.billingCycleStartDay]);

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  const estimatedCost = pending.reduce((sum, item) => sum + (item.price || 0), 0);
  const cartTotalCost = done.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleCloseModal = () => {
    setIsAddModalVisible(false);
    setEditingItem(null);
    setNewItem('');
    setNewQty('');
    setNewPrice('');
    setSelectedCategoryId(CATEGORIES[0].id);
  };

  const handleStartEdit = (item: GroceryItem) => {
    setEditingItem(item);
    setNewItem(item.name);
    setNewQty(item.qty || '');
    setNewPrice(item.price ? item.price.toString() : '');
    setSelectedCategoryId(item.category);
    setIsAddModalVisible(true);
  };

  const handleAdd = async () => {
    const name = newItem.trim();
    if (!name) return;

    const priceNum = parseFloat(newPrice) || 0;
    const currentUserName = userData?.username ? userData.username : (auth.currentUser?.email?.split('@')[0] || 'Member');
    
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'households', hid, 'groceries', editingItem.id), {
          name,
          category: selectedCategoryId,
          qty: newQty.trim(),
          price: priceNum,
        });
        showToast('Item updated', 'success');
      } else {
        await addDoc(collection(db, 'households', hid, 'groceries'), {
          name,
          done: false,
          category: selectedCategoryId,
          qty: newQty.trim(),
          price: priceNum,
          addedBy: currentUserName,
          expenseLogged: false,
          createdAt: serverTimestamp(),
        });
        logActivity(hid, 'grocery_add', name, currentUserName);
        showToast('Item added', 'success');

        try {
          const currentUid = auth.currentUser?.uid;
          if (currentUid) {
            const otherMembers = members.filter(uid => uid !== currentUid);
            const tokens = otherMembers
              .map(uid => memberProfiles[uid]?.pushToken)
              .filter(Boolean) as string[];

            if (tokens.length > 0) {
              const nameToUse = userData?.username ? userData.username : 'A roommate';
              sendRemotePushNotification(
                tokens,
                '🛒 Grocery List Update',
                `${nameToUse} added "${name}" to the shopping list.`
              );
            }
          }
        } catch (e) {
          console.error('Error sending push notifications for grocery add:', e);
        }
      }

      handleCloseModal();
    } catch {
      Alert.alert('Error', editingItem ? 'Could not update item.' : 'Could not add item.');
    }
  };

  const handleToggle = async (item: GroceryItem) => {
    const currentUserName = userData?.username ? userData.username : (auth.currentUser?.email?.split('@')[0] || 'Member');
    try {
      const isFinishing = !item.done;
      await updateDoc(doc(db, 'households', hid, 'groceries', item.id), {
        done: isFinishing,
      });
      if (isFinishing) {
        logActivity(hid, 'grocery_done', item.name, currentUserName);
      }
    } catch {
      Alert.alert('Error', 'Could not update item.');
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'households', hid, 'groceries', itemId));
      showToast('Item removed', 'success');
    } catch {
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
              const ref = doc(db, 'households', hid, 'groceries', item.id);
              batch.delete(ref);
            });
            await batch.commit();
            showToast('Cart cleared', 'success');
          } catch {
            Alert.alert('Error', 'Could not clear list.');
          }
        }
      }
    ]);
  };

  const executeLogExpense = async (item: GroceryItem, priceToUse: number) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    try {
      const categoryMatch = detectCategory(item.name);
      await addDoc(collection(db, 'households', hid, 'expenses'), {
        type: 'expense',
        title: `Groceries: ${item.name}`,
        amount: priceToUse,
        category: categoryMatch,
        paidByUid: currentUid,
        payerName: getMemberName(currentUid), 
        splitAmong: members, 
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'households', hid, 'groceries', item.id), {
        price: priceToUse,
        expenseLogged: true,
      });

      logActivity(hid, 'expense_add', `Groceries: ${item.name}`, getMemberName(currentUid), priceToUse);
      showToast('Logged to Expenses', 'success');
    } catch {
      Alert.alert('Error', 'Could not log to expenses.');
    }
  };

  const handleLogToExpenses = async (item: GroceryItem) => {
    if (!item.price || item.price <= 0) {
      setLoggingItem(item);
      setLogPrice('');
    } else {
      Alert.alert(
        'Log to Expenses',
        `Add an expense of ₹${item.price} for ${item.name}? This will be split among all members evenly.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Log Event', 
            style: 'default',
            onPress: () => executeLogExpense(item, item.price)
          }
        ]
      );
    }
  };

  const handleConfirmLogExpense = async () => {
    if (!loggingItem) return;
    const amount = parseFloat(logPrice) || 0;
    if (amount <= 0) {
      Alert.alert('Error', 'Please enter a valid price greater than 0.');
      return;
    }
    const itemToLog = loggingItem;
    setLoggingItem(null);
    await executeLogExpense(itemToLog, amount);
  };

  // Convert flat data into sectioned data for FlatList
  const listData: any[] = [];
  
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
    
    return (
      <GroceryItemRow
        key={groceryItem.id}
        item={groceryItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onEdit={handleStartEdit}
        onLogExpense={handleLogToExpenses}
        isDark={isDark}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <ScreenHeader 
        navigation={navigation as any} 
        title="Grocery"
        rightIcon="add"
        onRightPress={() => setIsAddModalVisible(true)}
      />

      <View className="flex-row mx-6 mb-2 gap-3">
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
            style={{ borderRadius: 24, padding: 16, borderWidth: 1, borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}
          >
            <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>To Spend</Text>
            <Text style={{ color: isDark ? '#FBBF24' : '#B45309', fontSize: 24, fontWeight: '900' }}>₹{estimatedCost.toFixed(0)}</Text>
          </LinearGradient>
        </View>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
            style={{ borderRadius: 24, padding: 16, borderWidth: 1, borderColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}
          >
            <Text style={{ color: isDark ? '#34D399' : '#065F46', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>In Cart Cost</Text>
            <Text style={{ color: isDark ? '#34D399' : '#059669', fontSize: 24, fontWeight: '900' }}>₹{cartTotalCost.toFixed(0)}</Text>
          </LinearGradient>
        </View>
      </View>

      {loading ? (
        <View className="px-6 gap-3 pt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} className="flex-row items-center bg-surface rounded-2xl p-4 border border-border">
              <Skeleton width={24} height={24} borderRadius={12} style={{ marginRight: 12 }} />
              <View className="flex-1">
                <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="30%" height={12} />
              </View>
              <Skeleton width={40} height={20} borderRadius={8} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={listData}
          keyExtractor={(i, index) => i.type === 'item' ? i.data.id : `header_${index}`}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
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
        onClose={handleCloseModal}
        title={editingItem ? "Edit Item" : "Add Item"}
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
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginRight: 12,
                    borderWidth: 1,
                    borderColor: isActive ? (isDark ? cat.bg : '#4F46E5') : (isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB'),
                    backgroundColor: isActive ? (isDark ? 'rgba(255,255,255,0.1)' : '#4F46E5') : (isDark ? '#161B33' : '#FFFFFF'),
                  }}
                >
                  <MaterialIcons 
                    name={cat.icon} 
                    size={16} 
                    color={isActive ? (isDark ? cat.bg : '#FFF') : (isDark ? '#94A3B8' : '#6B7280')} 
                  />
                  <Text style={{
                    marginLeft: 8,
                    fontSize: 13,
                    fontWeight: '800',
                    color: isActive ? (isDark ? '#FFF' : '#FFFFFF') : (isDark ? '#94A3B8' : '#6B7280'),
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
                onPress={handleCloseModal}
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

      {/* Log Expense Price Input Modal */}
      <SlideModal
        visible={!!loggingItem}
        onClose={() => setLoggingItem(null)}
        title="Log Expense"
      >
        <View className="pb-2 pt-2">
          <Text className="text-textMuted text-sm font-semibold mb-4 px-2">
            Enter the amount spent on <Text className="font-bold text-textMain">{loggingItem?.name}</Text>:
          </Text>
          <View className="border-b border-border/60 pb-2 mb-6 px-2">
            <Text className="text-textMuted text-xs font-bold mb-1">Actual Price</Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-textMain text-lg font-black mr-2">₹</Text>
              <TextInput
                className="flex-1 text-textMain text-lg font-bold"
                placeholder="0.00"
                placeholderTextColor="#D1D5DB"
                keyboardType="numeric"
                value={logPrice}
                onChangeText={setLogPrice}
                autoFocus
              />
            </View>
          </View>

          <View className="flex-row justify-between mt-4">
            <TouchableOpacity 
              className="flex-1 bg-background py-3.5 rounded-2xl items-center mr-3 border border-border/40"
              onPress={() => setLoggingItem(null)}
            >
              <Text className="text-textMuted font-bold text-sm">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 bg-textMain py-3.5 rounded-2xl items-center" 
              onPress={handleConfirmLogExpense}
            >
              <Text className="text-white font-bold text-sm">Log Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SlideModal>
    </SafeAreaView>
  );
}
