/*
 * FILE: src/screens/ChatScreen.tsx
 * PURPOSE: Group chat room for members of the household. It supports live message syncing,
 *          debounced batch reading indicators updates, and remote push alerts via Expo services.
 * WHERE USED: Loaded as the second tab option within MainTabs (App.tsx).
 */

// Import React hooks for managing state parameters, side-effect triggers, and elements refs
import React, { useState, useEffect, useRef } from 'react';
// Import essential layout components, lists, inputs, spinners, alerts, and animations
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
// Import safe area insets to adjust custom headers and input boxes positioning
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Import icon libraries
import { Ionicons } from '@expo/vector-icons';
// Import linear gradients for user message speech bubbles styling
import { LinearGradient } from 'expo-linear-gradient';
// Import database and auth references
import { auth, db } from '../firebaseConfig';
// Import User and Household context hooks
import { useUser } from '../context/UserContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
// Import custom avatar component
import { Avatar } from '../components/Avatar';
// Import push notification dispatcher
import { sendRemotePushNotification } from '../utils/notificationUtils';
// Import Firestore commands to listen to collections, append messages, update arrays, and run batches
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, doc, arrayUnion, writeBatch
} from 'firebase/firestore';
// Import message type schemas
import { Message } from '../types';

type Props = { navigation: any; route?: any };

/**
 * ChatScreen component containing live chat lists and emoji drawers.
 */
export default function ChatScreen({ route, navigation }: Props) {
  // Grab notch details
  const insets = useSafeAreaInsets();
  
  // Custom KeyboardAvoiding behaviors isolated specifically to the chat window
  const behavior = 'padding';
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 66 : 0;

  // Retrieve household metadata from context
  const { householdId, members, memberProfiles } = useHousehold();
  const hid = householdId ?? '';
  
  // Grab active theme mode
  const { isDark } = useTheme();
  const bg     = isDark ? '#070913' : '#F5F7FF';
  
  // State hook managing list of message items
  const [messages, setMessages] = useState<Message[]>([]);
  // State hook storing the current typed draft message
  const [inputText, setInputText] = useState('');
  // Loading spinner trigger state
  const [loading, setLoading] = useState(true);
  // Toggle flag showing if the quick emoji keyboard drawer is visible
  const [showEmojis, setShowEmojis] = useState(false);
  
  // Grab active user profile data
  const { profile: userData } = useUser();
  const { householdData } = useHousehold();
  
  // Ref referencing the scroll list to trigger scrolls to the bottom
  const flatListRef = useRef<FlatList>(null);
  // Ref flag indicating if the chat has finished loading its initial batch
  const isFirstLoad = useRef(true);

  // Effect: Connects Firestore live sync query targeting the household's messages subcollection
  useEffect(() => {
    if (!householdId) return;

    // Fetch latest 50 messages ordered by creation date descending
    const q = query(
      collection(db, 'households', hid, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, 
      (snap) => {
        // Map Firestore doc snapshots array to Message list items
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

  // Effect: Debounces marking incoming unread messages as read to optimize database writes
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid || messages.length === 0 || !householdId) return;

    // Filter incoming messages that were not sent by me and don't contain my UID in the readBy list
    const unreadMsgs = messages.filter(msg => 
      msg.senderId !== currentUid && (!msg.readBy || !msg.readBy.includes(currentUid))
    );

    if (unreadMsgs.length === 0) return;

    // Wait 500ms before dispatching updates. Prevents database write conflicts if many messages arrive.
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

  // Action: Appends message to database and fires push notifications to roommates
  const handleSend = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send messages.');
      return;
    }

    if (!inputText.trim()) return;
    const text = inputText.trim();
    // Clear field immediately to keep UI highly responsive
    setInputText('');

    try {
      // 1. Write message to Firestore subcollection
      await addDoc(collection(db, 'households', hid, 'messages'), {
        text,
        senderId: user.uid,
        senderName: userData?.username ? `${userData.username}` : (user.email?.split('@')[0] || 'Member'),
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      // 2. Dispatch push notification alerts asynchronously
      try {
        const otherMembers = members.filter(uid => uid !== user.uid);
        // Grab push tokens for all roommates
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

      // Scroll to bottom of list
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (e) {
      console.error("Message Send Error:", e);
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  // Component Renderer: Renders individual message blocks
  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    const isSystem = item.senderId === 'system';
    
    // Check previous message to group consecutive speech bubbles
    const previousMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showSenderName = !isMe && !isSystem && (!previousMessage || previousMessage.senderId !== item.senderId);

    // Message is read by others if readBy list size is greater than 1
    const isReadByOthers = item.readBy && item.readBy.length > 1;

    // Format display time
    const timeString = item.createdAt 
      ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Conditional checker: Displays date header divider when crossing day boundaries
    const showDateHeader = () => {
      const currentMsgDate = item.createdAt ? new Date(item.createdAt.seconds * 1000) : new Date();
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
      if (!nextMsg) return true;
      const nextMsgDate = nextMsg.createdAt ? new Date(nextMsg.createdAt.seconds * 1000) : new Date();
      return currentMsgDate.toDateString() !== nextMsgDate.toDateString();
    };

    // Helper formatting date titles
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

    // Render system system audit messages differently
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

    // Inner text and checkmark status content blocks
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
            // Blue double checkmark if read by roommates, muted if pending
            <Ionicons name="checkmark-done" size={14} color={isReadByOthers ? "#38BDF8" : "rgba(255,255,255,0.5)"} />
          )}
        </View>
      </View>
    );

    // Dynamic border radiuses based on sender to build speech bubbles bubbles
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
        {/* Render Day Header if boundary crossed */}
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
              // Empty spacer to align consecutive bubble clusters if avatar is hidden
              <View style={{ width: 34, marginRight: 8 }} />
            )
          )}
          {isMe ? (
            // Blue gradient bubbles for my own messages
            <LinearGradient
              colors={['#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bubbleStyle}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            // Solid dark/white bubbles for roommates messages
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
      {/* Top Header Section */}
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
        {/* Back button */}
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={{ marginRight: 12, width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#151D35' : '#F1F5F9', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <Ionicons name="arrow-back" size={20} color={isDark ? '#F1F5F9' : '#1E1B4B'} />
        </TouchableOpacity>

        {/* Room description info */}
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
              inverted // Inverts list to position newer items at the bottom scroll anchor
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              decelerationRate="fast"
              scrollEventThrottle={16}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }} // Prevents list jumping during rendering
            />
          )}

          {/* Quick Emoji Bar selection */}
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
            {/* Toggle emoji bar button */}
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

            {/* Send button */}
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
