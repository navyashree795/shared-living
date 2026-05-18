import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Platform, Keyboard } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

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

  return (
    <View style={{
      position: 'absolute',
      bottom: insets.bottom > 0 ? insets.bottom : 20,
      left: 20,
      right: 20,
      height: 72,
      backgroundColor: isDark ? '#1A1D3B' : '#FFFFFF',
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

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ alignItems: 'center', gap: 3 }}>
              {/* Icon Container with background when active */}
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
