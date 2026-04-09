import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import ScreenHeader from '../components/ScreenHeader';
import { useUser } from '../context/UserContext';
import { 
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Message } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { householdId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const { profile: userData } = useUser();

  useEffect(() => {
    if (!householdId) return;

    // Listen for messages
    const q = query(
      collection(db, 'households', householdId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      setLoading(false);
    });

    return unsub;
  }, [householdId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'households', householdId, 'messages'), {
        text,
        senderId: auth.currentUser?.uid,
        senderName: userData?.username ? `@${userData.username}` : (auth.currentUser?.email?.split('@')[0] || 'Member'),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Message Error:", e);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    
    return (
      <View className={`flex-row mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
        {!isMe && (
          <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mr-2 self-end">
            <Text className="text-[10px] font-bold text-textMuted">{item.senderName?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View className={`max-w-[75%] px-4 py-3 rounded-[24px] ${isMe ? 'bg-primary rounded-tr-none' : 'bg-white border border-border rounded-tl-none'}`}>
          {!isMe && (
            <Text className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
              {item.senderName}
            </Text>
          )}
          <Text className={`text-sm font-medium ${isMe ? 'text-white' : 'text-textMain'}`}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader navigation={navigation as any} title="Household Chat" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator color="#4F46E5" />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Bar */}
        <View className="px-5 pb-6 pt-3 bg-white border-t border-border flex-row items-center gap-3">
          <TextInput
            className="flex-1 bg-background rounded-2xl px-5 py-4 text-textMain text-sm border border-border"
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            onPress={handleSend}
            disabled={!inputText.trim()}
            className={`w-14 h-14 rounded-2xl items-center justify-center shadow-lg ${inputText.trim() ? 'bg-primary shadow-primary/40' : 'bg-gray-100'}`}
          >
            <MaterialIcons name="send" size={24} color={inputText.trim() ? "#FFF" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
