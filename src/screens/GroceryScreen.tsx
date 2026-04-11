import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { logActivity } from '../utils/activityUtils';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp
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
  const [loading, setLoading] = useState(true);

  const selectedCategory = useMemo(() => 
    CATEGORIES.find(c => c.id === selectedCategoryId) || CATEGORIES[0],
    [selectedCategoryId]
  );

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
        createdAt: serverTimestamp(),
      });
      logActivity(householdId, 'grocery_add', name);
      setNewItem(''); setNewQty(''); setNewPrice('');
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

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  const renderItem = ({ item }: { item: GroceryItem }) => {
    const category = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];
    
    return (
      <View className="flex-row items-center bg-white rounded-[24px] p-4 mb-3 border border-border shadow-sm">
        <TouchableOpacity className="mr-3" onPress={() => handleToggle(item)}>
          <MaterialIcons 
            name={item.done ? "check-box" : "check-box-outline-blank"} 
            size={26} 
            color={item.done ? "#10B981" : "#9CA3AF"} 
          />
        </TouchableOpacity>
        
        <View style={{ backgroundColor: category.bg }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
          <MaterialIcons name={category.icon} size={20} color={category.color} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text className={`text-base font-bold ${item.done ? 'text-textMuted line-through' : 'text-textMain'}`}>
              {item.name}
            </Text>
            {item.qty ? <Text className="text-primary text-[11px] font-black ml-2 uppercase tracking-tight">{item.qty}</Text> : null}
          </View>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-[10px] text-textMuted font-bold uppercase tracking-widest">{category.name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2 ml-2">
          <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        
        <ScreenHeader navigation={navigation} title="Grocery List">
          <View className="bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
             <Text className="text-primary font-bold text-xs tracking-wider">{pending.length} LEFT</Text>
          </View>
        </ScreenHeader>

        {loading ? (
          <ActivityIndicator color="#4F46E5" className="mt-10" />
        ) : (
          <FlatList
            data={[...pending, ...done]}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 220 }}
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

        {/* Add Input Area */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-border shadow-2xl pb-10 pt-4">
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

          <View className="px-6 gap-3">
            <View className="flex-row gap-3">
              <TextInput
                className="flex-[2] bg-background rounded-2xl px-5 py-4 text-textMain text-base border border-border"
                placeholder={`What ${selectedCategory.name}?`}
                placeholderTextColor="#9CA3AF"
                value={newItem}
                onChangeText={setNewItem}
              />
              <TextInput
                className="flex-1 bg-background rounded-2xl px-4 py-4 text-textMain text-sm border border-border font-medium"
                placeholder="Qty (2kg)"
                placeholderTextColor="#9CA3AF"
                value={newQty}
                onChangeText={setNewQty}
              />
            </View>
            
            <View className="flex-row gap-3 items-center">
              <View className="flex-1 flex-row items-center bg-background rounded-2xl px-5 py-3 border border-border">
                <Text className="text-textMuted font-bold mr-2 text-base">₹</Text>
                <TextInput
                  className="flex-1 text-textMain text-base font-bold"
                  placeholder="Estimated Price"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={newPrice}
                  onChangeText={setNewPrice}
                />
              </View>
              <TouchableOpacity 
                className="bg-primary rounded-2xl w-14 h-14 items-center justify-center shadow-lg" 
                onPress={handleAdd}
              >
                <MaterialIcons name="add" size={32} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
