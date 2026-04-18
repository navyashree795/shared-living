import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { 
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, updateDoc, doc, arrayUnion
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Message } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { householdId, householdData } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const { profile: userData } = useUser();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  
  const [newMsgPopup, setNewMsgPopup] = useState<Message | null>(null);
  const notificationAnim = useRef(new Animated.Value(-150)).current; 
  const isFirstLoad = useRef(true);

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
        // Detect new messages for notification
        snap.docChanges().forEach((change) => {
          if (change.type === "added" && !isFirstLoad.current && !snap.metadata.hasPendingWrites) {
             const msg = { id: change.doc.id, ...change.doc.data() } as Message;
             if (msg.senderId !== auth.currentUser?.uid) {
                setNewMsgPopup(msg);
                Animated.spring(notificationAnim, {
                  toValue: insets.top + 10,
                  useNativeDriver: true,
                  tension: 40,
                  friction: 8
                }).start();

                setTimeout(() => {
                  Animated.timing(notificationAnim, {
                    toValue: -150,
                    duration: 500,
                    useNativeDriver: true
                  }).start(() => setNewMsgPopup(null));
                }, 4000);
             }
          }
        });

        const fetchedMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setMessages(fetchedMessages);
        setLoading(false);
        isFirstLoad.current = false;

        // Mark unread messages as read
        const currentUid = auth.currentUser?.uid;
        if (currentUid) {
          fetchedMessages.forEach(msg => {
            if (msg.senderId !== currentUid && (!msg.readBy || !msg.readBy.includes(currentUid))) {
              updateDoc(doc(db, 'households', householdId, 'messages', msg.id), {
                readBy: arrayUnion(currentUid)
              }).catch(e => console.error("Error marking read:", e));
            }
          });
        }
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
        senderName: userData?.username ? `${userData.username}` : (user.email?.split('@')[0] || 'Member'),
        readBy: [user.uid],
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

    const isReadByOthers = item.readBy && item.readBy.length > 1;

    return (
      <View style={{ flexDirection: 'row', marginBottom: 6, justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
        {!isMe && (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4F46E5' }}>{item.senderName[0].toUpperCase()}</Text>
          </View>
        )}
        <View 
          style={{
            maxWidth: '80%',
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: isMe ? '#5145CD' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderBottomLeftRadius: isMe ? 24 : 0,
            borderBottomRightRadius: isMe ? 0 : 24,
            borderWidth: isMe ? 0 : 1,
            borderColor: '#F3F4F6',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          {showSenderName && (
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#818CF8', marginBottom: 2, textTransform: 'uppercase' }}>
              {item.senderName}
            </Text>
          )}
          <View>
            <Text style={{ fontSize: 15, color: isMe ? '#FFFFFF' : '#1F2937', lineHeight: 22 }}>
              {item.text}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
              <Text style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>
                {timeString}
              </Text>
              {isMe && (
                <View style={{ marginLeft: 4 }}>
                  <Ionicons 
                    name="checkmark-done" 
                    size={16} 
                    color={isReadByOthers ? "#38BDF8" : "rgba(255,255,255,0.5)"} 
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header - Moved outside KeyboardAvoidingView for stability */}
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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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

            {/* Quick Emoji Bar */}
            {showEmojis && (
              <View style={{ backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 10 }}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={[
                    '❤️', '😂', '😮', '😢', '😡', '👍', '🙏', '🔥', '✨', '✔️', '🎉', 
                    '😀', '😍', '😎', '🤩', '😊', '🤔', '🙄', '😴', '😭', '😔', '😤',
                    '🏠', '🧹', '🧺', '💰', '🍕', '🍴', '☕', '🧼', '✅', '❌'
                  ]}
                  keyExtractor={(item) => item}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      onPress={() => setInputText(prev => prev + item)}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 24 }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
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
              <TouchableOpacity 
                onPress={() => setShowEmojis(!showEmojis)}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 2 }}
              >
                <Ionicons name={showEmojis ? "keypad" : "happy-outline"} size={24} color={showEmojis ? "#5145CD" : "#9CA3AF"} />
              </TouchableOpacity>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#F3F4F6', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4, marginRight: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <TextInput
                  style={{ flex: 1, fontSize: 15, color: 'black', maxHeight: 120, paddingTop: 12, paddingBottom: 12, minHeight: 46 }}
                  placeholder="Type a message..."
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  onFocus={() => setShowEmojis(false)}
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
                  backgroundColor: inputText.trim() ? '#5145CD' : '#F3F4F6',
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
      </KeyboardAvoidingView>

      {/* NEW: Top Floating Message Notification */}
      {newMsgPopup && (
        <Animated.View 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 16,
            right: 16,
            zIndex: 9999,
            transform: [{ translateY: notificationAnim }]
          }}
        >
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => {
              Animated.timing(notificationAnim, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true
              }).start(() => setNewMsgPopup(null));
            }}
            className="bg-indigo-600 rounded-2xl p-3 shadow-2xl flex-row items-center border border-white/20"
          >
            <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-[9px] font-black uppercase tracking-widest opacity-80">
                New Message
              </Text>
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {newMsgPopup.senderName}: {newMsgPopup.text}
              </Text>
            </View>
            <View className="bg-white/10 p-1.5 rounded-full">
              <Ionicons name="close" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

