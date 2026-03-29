import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const NAV_ITEMS = [
  {
    name: 'Grocery',
    icon: 'shopping-cart',
    color: '#10B981', // Emerald green
    bg: '#ECFDF5',    // Very light emerald
    subtitle: 'Shared shopping list',
  },
  {
    name: 'Expenses',
    icon: 'receipt-long',
    color: '#4F46E5', // Indigo
    bg: '#EEF2FF',    // Very light indigo
    subtitle: 'Split bills & balances',
  },
  {
    name: 'Chores',
    icon: 'cleaning-services',
    color: '#F59E0B', // Amber
    bg: '#FFFBEB',    // Very light amber
    subtitle: 'Assign household tasks',
  },
];

export default function DashboardScreen({ navigation, householdId, householdData }) {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) setUserData(snap.data());
        } catch {}
      }
    };
    fetchUserData();
  }, []);

  const members = householdData?.members || [];

  const handleNav = (screenName) => {
    navigation.navigate(screenName, { householdId, members });
  };

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      {/* Header */}
      <View className="flex-row items-center mt-2 mb-6">
        <TouchableOpacity onPress={() => setIsMenuVisible(true)} className="mr-4 p-1">
          <MaterialIcons name="menu" size={28} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-textMuted text-sm font-medium">Good day 👋</Text>
          <Text className="text-textMain text-3xl font-extrabold mt-1">
            {householdData?.name || 'My Household'}
          </Text>
        </View>
      </View>

      {/* Invite Code Chip */}
      <View className="flex-row items-center gap-1 bg-white rounded-full px-4 py-2 self-start mb-8 border border-border shadow-sm">
        <MaterialIcons name="vpn-key" size={14} color="#6B7280" />
        <Text className="text-textMuted text-sm">Invite Code: </Text>
        <Text className="text-primary text-sm font-extrabold tracking-widest">
          {householdData?.inviteCode || '...'}
        </Text>
        <Text className="text-textMuted text-sm ml-1">
          · {members.length} member{members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Feature Cards */}
      <View className="flex-1 gap-4">
        {NAV_ITEMS.map(item => (
          <TouchableOpacity
            key={item.name}
            className="flex-1 rounded-3xl p-6 border justify-start shadow-sm"
            style={{ backgroundColor: item.bg, borderColor: `${item.color}30` }}
            onPress={() => handleNav(item.name)}
            activeOpacity={0.7}
          >
            <View 
              className="w-14 h-14 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: `${item.color}20` }}
            >
              <MaterialIcons name={item.icon} size={32} color={item.color} />
            </View>
            <Text className="text-2xl font-extrabold mb-1" style={{ color: item.color }}>
              {item.name}
            </Text>
            <Text className="text-base font-medium" style={{ color: `${item.color}90` }}>
              {item.subtitle}
            </Text>
            <MaterialIcons 
              name="arrow-forward" 
              size={20} 
              color={`${item.color}80`} 
              style={{ marginTop: 12 }} 
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Side Menu */}
      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity className="flex-1 bg-black/60" activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <View className="w-[78%] h-full bg-white px-6 border-r border-border shadow-2xl">
            <SafeAreaView className="flex-1">
              {/* Menu Header */}
              <View className="mt-10 mb-6">
                <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mb-4 shadow-md">
                  <Text className="text-white text-2xl font-extrabold">
                    {auth.currentUser?.email?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-textMain text-lg font-bold mb-1">
                  {auth.currentUser?.email}
                </Text>
                <Text className="text-textMuted text-sm">
                  {userData?.phoneNumber || 'No phone added'}
                </Text>
              </View>

              <View className="h-[1px] bg-border my-5" />

              {/* Household Info */}
              <Text className="text-textMuted text-xs font-bold tracking-widest mb-3">HOUSEHOLD</Text>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="home" size={20} color="#6B7280" />
                <Text className="text-textMain text-base font-medium">{householdData?.name}</Text>
              </View>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="vpn-key" size={20} color="#6B7280" />
                <Text className="text-textMain text-base font-medium">{householdData?.inviteCode}</Text>
              </View>
              <View className="flex-row items-center gap-3 py-2">
                <MaterialIcons name="people" size={20} color="#6B7280" />
                <Text className="text-textMain text-base font-medium">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <View className="h-[1px] bg-border my-5" />

              {/* Logout */}
              <TouchableOpacity
                className="flex-row items-center py-4 gap-3 mt-auto mb-6"
                onPress={() => { setIsMenuVisible(false); auth.signOut(); }}
              >
                <MaterialIcons name="logout" size={24} color="#EF4444" />
                <Text className="text-danger text-base font-bold">Sign Out</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
