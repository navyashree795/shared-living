import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { 
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Message } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { householdId, householdData } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const { profile: userData } = useUser();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!householdId) {
      Alert.alert('Error', 'Missing household information.');
      navigation.goBack();
      return;
    }

    const q = query(
      collection(db, 'households', householdId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, 
      (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
        setLoading(false);
      },
      (error) => {
        console.error("Chat Subscription Error:", error);
        setLoading(false);
        Alert.alert('Sync Error', 'Could not load messages. Please try again later.');
      }
    );

    return unsub;
  }, [householdId, navigation]);

  const handleSend = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send messages.');
      return;
    }

    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'households', householdId, 'messages'), {
        text,
        senderId: user.uid,
        senderName: userData?.username ? `@${userData.username}` : (user.email?.split('@')[0] || 'Member'),
        createdAt: serverTimestamp(),
      });
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      console.error("Message Send Error:", e);
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const previousMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showSenderName = !isMe && (!previousMessage || previousMessage.senderId !== item.senderId);

    const timeString = item.createdAt 
      ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={{ flexDirection: 'row', marginBottom: 12, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
        <View 
          style={{
            maxWidth: '75%',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isMe ? '#000000' : '#FFFFFF',
            borderRadius: 20,
            borderBottomRightRadius: isMe ? 4 : 20,
            borderBottomLeftRadius: !isMe ? 4 : 20,
            borderWidth: isMe ? 0 : 1,
            borderColor: '#F3F4F6',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          {showSenderName && (
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              {item.senderName}
            </Text>
          )}
          <View>
            <Text style={{ fontSize: 15, color: isMe ? '#FFFFFF' : '#111827', lineHeight: 22 }}>
              {item.text}
            </Text>
            <Text style={{ fontSize: 10, marginTop: 4, textAlign: 'right', color: isMe ? '#9CA3AF' : '#9CA3AF' }}>
              {timeString}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
          {/* Header */}
          <View 
            style={{ 
              backgroundColor: 'white', 
              flexDirection: 'row', 
              alignItems: 'center', 
              paddingHorizontal: 16, 
              paddingVertical: 12, 
              borderBottomWidth: 1, 
              borderBottomColor: '#F3F4F6',
              paddingTop: insets.top + 12,
              zIndex: 10
            }}
          >
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ marginRight: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' }}
            >
              <Ionicons name="arrow-back" size={20} color="#000" />
            </TouchableOpacity>

            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ color: 'black', fontSize: 18, fontWeight: 'bold' }} numberOfLines={1}>
                {householdData?.name || 'Household Chat'}
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: 'medium', marginTop: 2 }}>
                {householdData?.members?.length || 0} members
              </Text>
            </View>

            <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Ionicons name="information" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color="#000" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              />
            )}

            {/* Input Bar */}
            <View 
              style={{ 
                flexDirection: 'row', 
                alignItems: 'flex-end', 
                paddingHorizontal: 16, 
                paddingVertical: 12, 
                backgroundColor: 'white', 
                borderTopWidth: 1, 
                borderTopColor: '#F3F4F6', 
                minHeight: 70,
                paddingBottom: Math.max(insets.bottom, 12)
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#F3F4F6', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, marginRight: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: 'black', maxHeight: 120, paddingTop: 12, paddingBottom: 12, minHeight: 46 }}
                  placeholder="Type a message..."
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                />
              </View>

              <TouchableOpacity 
                onPress={handleSend}
                disabled={!inputText.trim()}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 24, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: inputText.trim() ? 'black' : '#F3F4F6',
                  marginBottom: 2 
                }}
              >
                <Ionicons 
                  name="send" 
                  size={18} 
                  color={inputText.trim() ? "#FFF" : "#9CA3AF"} 
                  style={{ marginLeft: 2 }} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

