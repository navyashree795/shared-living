import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from '../components/Avatar';
import { sendRemotePushNotification } from '../utils/notificationUtils';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, doc, arrayUnion, writeBatch
} from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Message } from '../types';

type Props = { navigation: any; route?: any };

export default function ChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  
  // Decoupled KeyboardAvoidingView configuration for ChatScreen.
  // This allows tuning Android & iOS keyboard behaviors independently for the chat screen without affecting other screens.
  const behavior = 'padding';
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 66 : 0;

  const { householdId, members, memberProfiles } = useHousehold();
  const hid = householdId ?? '';
  const { isDark } = useTheme();
  const bg     = isDark ? '#070913' : '#F5F7FF';
  const chatBg = isDark ? '#070913' : '#F5F7FF';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const { profile: userData } = useUser();
  const { householdData } = useHousehold();
  const flatListRef = useRef<FlatList>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!householdId) return;

    const q = query(
      collection(db, 'households', hid, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, 
      (snap) => {
        // Detect new messages for notification
        snap.docChanges().forEach((change) => {
          if (change.type === "added" && !isFirstLoad.current && !snap.metadata.hasPendingWrites) {
             // Notification logic removed
          }
        });

        const fetchedMessages = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Message));
          
        setMessages(fetchedMessages);
        setLoading(false);
        isFirstLoad.current = false;
      },
      (error) => {
        console.error("Chat Subscription Error:", error);
        setLoading(false);
        Alert.alert('Sync Error', 'Could not load messages. Please try again later.');
      }
    );

    return unsub;
  }, [householdId, navigation, insets.top]);

  // Decoupled & debounced effect to mark incoming messages as read without blocking onSnapshot thread
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid || messages.length === 0 || !householdId) return;

    const unreadMsgs = messages.filter(msg => 
      msg.senderId !== currentUid && (!msg.readBy || !msg.readBy.includes(currentUid))
    );

    if (unreadMsgs.length === 0) return;

    const timer = setTimeout(() => {
      const batch = writeBatch(db);
      unreadMsgs.forEach(msg => {
        batch.update(doc(db, 'households', hid, 'messages', msg.id), {
          readBy: arrayUnion(currentUid)
        });
      });
      batch.commit().catch(error => console.error("Error batch marking read:", error));
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, hid, householdId]);

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
      await addDoc(collection(db, 'households', hid, 'messages'), {
        text,
        senderId: user.uid,
        senderName: userData?.username ? `${userData.username}` : (user.email?.split('@')[0] || 'Member'),
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      try {
        const otherMembers = members.filter(uid => uid !== user.uid);
        const tokens = otherMembers
          .map(uid => memberProfiles[uid]?.pushToken)
          .filter(Boolean) as string[];

        if (tokens.length > 0) {
          const senderName = userData?.username ? userData.username : 'A roommate';
          sendRemotePushNotification(
            tokens,
            `💬 Message in ${householdData?.name || 'Household'}`,
            `${senderName}: ${text}`
          );
        }
      } catch (e) {
        console.error('Error sending push notifications for chat message:', e);
      }

      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      console.error("Message Send Error:", e);
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const isSystem = item.senderId === 'system';
    const previousMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showSenderName = !isMe && !isSystem && (!previousMessage || previousMessage.senderId !== item.senderId);

    const isReadByOthers = item.readBy && item.readBy.length > 1;

    const timeString = item.createdAt 
      ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const showDateHeader = () => {
      const currentMsgDate = item.createdAt ? new Date(item.createdAt.seconds * 1000) : new Date();
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
      if (!nextMsg) return true;
      const nextMsgDate = nextMsg.createdAt ? new Date(nextMsg.createdAt.seconds * 1000) : new Date();
      return currentMsgDate.toDateString() !== nextMsgDate.toDateString();
    };

    const formatDateHeader = (date: Date) => {
      const now = new Date();
      if (date.toDateString() === now.toDateString()) return 'Today';
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const nextMessageFromSameSender = index > 0 && messages[index - 1].senderId === item.senderId;
    const showAvatar = !isMe && !isSystem && (!previousMessage || previousMessage.senderId !== item.senderId);

    if (isSystem) {
      return (
        <View>
          {showDateHeader() && (
            <View style={{ alignItems: 'center', marginVertical: 18 }}>
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99, 102, 241, 0.06)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99, 102, 241, 0.04)' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#A78BFA' : '#4F46E5', letterSpacing: 0.5 }}>
                  {formatDateHeader(item.createdAt ? new Date(item.createdAt.seconds * 1000) : new Date())}
                </Text>
              </View>
            </View>
          )}
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <View style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#94A3B8' : '#64748B' }}>{item.text}</Text>
            </View>
          </View>
        </View>
      );
    }

    const bubbleContent = (
      <View>
        {showSenderName && (
          <Text style={{ fontSize: 10, fontWeight: '800', color: isMe ? '#A5B4FC' : '#818CF8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
            {item.senderName}
          </Text>
        )}
        <Text style={{ fontSize: 15, color: isMe ? '#FFFFFF' : (isDark ? '#F1F5F9' : '#0F172A'), lineHeight: 21 }}>
          {item.text}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
          <Text style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.7)' : (isDark ? '#64748B' : '#9CA3AF'), fontWeight: '600' }}>
            {timeString}
          </Text>
          {isMe && (
            <Ionicons name="checkmark-done" size={14} color={isReadByOthers ? "#38BDF8" : "rgba(255,255,255,0.5)"} />
          )}
        </View>
      </View>
    );

    const bubbleStyle: any = {
      maxWidth: '78%',
      borderRadius: 22,
      borderTopRightRadius: isMe ? 4 : 22,
      borderTopLeftRadius: !isMe ? 4 : 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      shadowColor: isMe ? '#6366F1' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isMe ? 0.15 : 0.05,
      shadowRadius: 4,
      elevation: 2,
    };

    return (
      <View>
        {showDateHeader() && (
          <View style={{ alignItems: 'center', marginVertical: 18 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99, 102, 241, 0.06)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99, 102, 241, 0.04)' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#A78BFA' : '#4F46E5', letterSpacing: 0.5 }}>
                {formatDateHeader(item.createdAt ? new Date(item.createdAt.seconds * 1000) : new Date())}
              </Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', marginBottom: nextMessageFromSameSender ? 3 : 10, justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
          {!isMe && (
            showAvatar ? (
              <Avatar 
                name={item.senderName} 
                size={34} 
                photoUrl={memberProfiles[item.senderId]?.photoUrl}
                style={{ marginRight: 8, marginBottom: 2 }} 
              />
            ) : (
              <View style={{ width: 34, marginRight: 8 }} />
            )
          )}
          {isMe ? (
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bubbleStyle}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            <View 
              style={[
                bubbleStyle,
                { 
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(99, 102, 241, 0.06)',
                }
              ]}
            >
              {bubbleContent}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View 
        style={{ 
          backgroundColor: isDark ? '#0E1324' : '#FFFFFF', 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomWidth: 1, 
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)',
          paddingTop: insets.top + 12,
          zIndex: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.2 : 0.04,
          shadowRadius: 10,
          elevation: 4
        }}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={{ marginRight: 12, width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#151D35' : '#F1F5F9', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <Ionicons name="arrow-back" size={20} color={isDark ? '#F1F5F9' : '#1E1B4B'} />
        </TouchableOpacity>

        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#6366F120', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#6366F130' }}>
          <Ionicons name="chatbubbles" size={20} color="#6366F1" />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ color: isDark ? '#F1F5F9' : '#1E1B4B', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1}>
            {householdData?.name || 'Household Chat'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 }} />
            <Text style={{ color: isDark ? '#818CF8' : '#4F46E5', fontSize: 12, fontWeight: '700' }}>
              {householdData?.members?.length || 0} Roommates
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={isDark ? '#818CF8' : '#6366F1'} />
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
              decelerationRate="fast"
              scrollEventThrottle={16}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            />
          )}

          {/* Quick Emoji Bar */}
          {showEmojis && (
            <View style={{ backgroundColor: isDark ? '#0E1324' : '#FFFFFF', borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)', paddingVertical: 12 }}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={[
                  '👋', '👍', '🙏', '❤️', '😂', '😮', '😢', '😡', '🔥', '✨', '✔️', '🎉', 
                  '🏠', '🧹', '💰', '🍕', '🍴', '☕', '🧼', '✅', '❌', '😴', '😭', '🤔'
                ]}
                keyExtractor={(item) => item}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    onPress={() => setInputText(prev => prev + item)}
                    activeOpacity={0.7}
                    style={{ 
                      width: 46, 
                      height: 46, 
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(99, 102, 241, 0.03)',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.04)'
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Floating Pill Input Bar */}
          <View 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginHorizontal: 16,
              marginBottom: Math.max(insets.bottom, 12),
              marginTop: 8,
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              backgroundColor: isDark ? '#0E1324' : '#FFFFFF', 
              borderRadius: 28,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 12,
              elevation: 6
            }}
          >
            <TouchableOpacity 
              onPress={() => setShowEmojis(!showEmojis)}
              activeOpacity={0.8}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#151D35' : '#F1F5F9' }}
            >
              <Ionicons name={showEmojis ? "keypad-outline" : "happy-outline"} size={22} color={showEmojis ? "#6366F1" : (isDark ? '#94A3B8' : '#64748B')} />
            </TouchableOpacity>

            <TextInput
              style={{ 
                flex: 1, 
                fontSize: 15, 
                color: isDark ? '#F1F5F9' : '#0F172A', 
                maxHeight: 120, 
                paddingTop: Platform.OS === 'ios' ? 8 : 6, 
                paddingBottom: Platform.OS === 'ios' ? 8 : 6, 
                paddingHorizontal: 12, 
                fontWeight: '500',
                textAlignVertical: 'center'
              }}
              placeholder="Message team..."
              placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onFocus={() => setShowEmojis(false)}
            />

            <TouchableOpacity 
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
              style={{ 
                width: 40, height: 40, borderRadius: 20, 
                alignItems: 'center', justifyContent: 'center', 
                backgroundColor: inputText.trim() ? '#6366F1' : (isDark ? '#1E293B' : '#F1F5F9'),
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: inputText.trim() ? 0.3 : 0,
                shadowRadius: 6,
                elevation: inputText.trim() ? 4 : 0
              }}
            >
              <Ionicons name="send" size={16} color={inputText.trim() ? "#FFF" : (isDark ? '#475569' : '#94A3B8')} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

