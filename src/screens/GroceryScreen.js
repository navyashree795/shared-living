import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { auth, db } from '../firebaseConfig';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';

export default function GroceryScreen({ route, navigation }) {
  const { householdId } = route.params;
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) setUserData(snap.data());
        } catch (e) {
          console.error("Error fetching user data:", e);
        }
      }
    };
    fetchUserData();

    const q = query(
      collection(db, 'households', householdId, 'groceries'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const handleAdd = async () => {
    const name = newItem.trim();
    if (!name) return;
    setNewItem('');
    try {
      console.log(`Adding grocery to households/${householdId}/groceries`);
      await addDoc(collection(db, 'households', householdId, 'groceries'), {
        name,
        done: false,
        addedBy: userData?.username ? `@${userData.username}` : (auth.currentUser?.email || 'Unknown'),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Grocery Add Error:', e);
      Alert.alert('Error', 'Could not add item. ' + e.message);
    }
  };

  const handleToggle = async (item) => {
    try {
      console.log(`Updating grocery households/${householdId}/groceries/${item.id}`);
      await updateDoc(doc(db, 'households', householdId, 'groceries', item.id), {
        done: !item.done,
      });
    } catch (e) {
      console.error('Grocery Toggle Error:', e);
      Alert.alert('Error', 'Could not update item.');
    }
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteDoc(doc(db, 'households', householdId, 'groceries', itemId));
    } catch (e) {
      Alert.alert('Error', 'Could not delete item.');
    }
  };

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  const renderItem = ({ item }) => (
    <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
      <TouchableOpacity className="mr-3" onPress={() => handleToggle(item)}>
        {item.done
          ? <MaterialIcons name="check-box" size={26} color="#10B981" />
          : <MaterialIcons name="check-box-outline-blank" size={26} color="#9CA3AF" />
        }
      </TouchableOpacity>
      <View className="flex-1">
        <Text className={`text-base font-bold ${item.done ? 'text-textMuted line-through' : 'text-textMain'}`}>
          {item.name}
        </Text>
        <Text className="text-xs text-textMuted mt-0.5 font-medium">Added by {item.addedBy}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2 ml-2">
        <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        
        {/* Header */}
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 130 }}
            ListEmptyComponent={
              <EmptyState 
                icon="shopping-cart" 
                title="Your list is empty!" 
                description="Add your first item below so your roommates know what to buy."
              />
            }
            ListHeaderComponent={done.length > 0 && pending.length > 0 ? (
              <Text className="text-textMuted text-xs font-bold tracking-widest my-3 ml-1">COMPLETED</Text>
            ) : null}
            ListFooterComponent={done.length > 0 ? (
              <TouchableOpacity
                className="items-center p-4 mt-2 mb-6"
                onPress={() => {
                  Alert.alert('Clear Done', 'Remove all checked items?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: () => done.forEach(i => handleDelete(i.id)) }
                  ]);
                }}
              >
                <Text className="text-danger font-bold text-sm">Clear completed ({done.length})</Text>
              </TouchableOpacity>
            ) : null}
          />
        )}

        {/* Add Input */}
        <View className="absolute bottom-0 left-0 right-0 flex-row px-6 pb-8 pt-4 bg-white border-t border-border shadow-2xl items-center gap-3">
          <TextInput
            className="flex-1 bg-background rounded-2xl px-5 py-4 text-textMain text-base border border-border"
            placeholder="Add an item..."
            placeholderTextColor="#9CA3AF"
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity 
            className="bg-primary rounded-2xl w-14 h-14 items-center justify-center shadow-md shadow-primary/40" 
            onPress={handleAdd}
          >
            <MaterialIcons name="add" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
