import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Platform, Keyboard } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { useHousehold } from '../context/HouseholdContext';

type TabConfig = {
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

const TAB_CONFIG: TabConfig[] = [
  { name: 'Dashboard', icon: 'home', label: 'Home' },
  { name: 'Grocery',   icon: 'shopping-cart', label: 'Grocery' },
  { name: 'Expenses',  icon: 'attach-money', label: 'Expenses' },
  { name: 'Chores',    icon: 'cleaning-services', label: 'Chores' },
  { name: 'Chat',      icon: 'chat', label: 'Chat' },
];

export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { unreadMessagesCount, pendingGroceriesCount, pendingChoresCount } = useHousehold();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Hide the bottom tab bar completely on the Chat screen or when the keyboard is active
  const currentRouteName = state.routes[state.index]?.name;
  if (currentRouteName === 'Chat' || isKeyboardVisible) {
    return null;
  }

  const tabBgColor = isDark ? '#1A1D3B' : '#FFFFFF';

  return (
    <View style={{
      position: 'absolute',
      bottom: insets.bottom > 0 ? insets.bottom : 20,
      left: 20,
      right: 20,
      height: 72,
      backgroundColor: tabBgColor,
      borderRadius: 36,
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 20,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
    }}>
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG.find(t => t.name === route.name);
        if (!config) return null;

        const isFocused = state.index === index;
        const color = isFocused 
          ? (isDark ? '#A78BFA' : '#4F46E5') 
          : (isDark ? '#64748B' : '#94A3B8');

        let badgeCount = 0;
        if (route.name === 'Chat') badgeCount = unreadMessagesCount;
        if (route.name === 'Grocery') badgeCount = pendingGroceriesCount;
        if (route.name === 'Chores') badgeCount = pendingChoresCount;

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ alignItems: 'center', gap: 3 }}>
              {/* Icon Container with relative positioning for Badge */}
              <View style={{ position: 'relative' }}>
                <View style={{
                  backgroundColor: isFocused ? (isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF') : 'transparent',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MaterialIcons
                    name={config.icon as any}
                    size={22}
                    color={color}
                  />
                </View>
                {/* Red Notification Badge */}
                {badgeCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#EF4444',
                    borderRadius: 9,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                    borderWidth: 1.5,
                    borderColor: tabBgColor,
                    zIndex: 10,
                  }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900' }}>
                      {badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ 
                fontSize: 10, 
                color: color, 
                fontWeight: isFocused ? '800' : '600',
              }}>
                {config.label}
              </Text>
              {/* Active Dot indicator */}
              <View style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: isFocused ? color : 'transparent',
                marginTop: 1,
              }} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
