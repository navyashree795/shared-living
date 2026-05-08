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
      bottom: insets.bottom > 0 ? insets.bottom : 12,
      left: 16,
      right: 16,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(167, 139, 250, 0.18)' : 'rgba(99, 102, 241, 0.18)',
      backgroundColor: isDark ? 'rgba(4, 5, 12, 0.94)' : 'rgba(255, 255, 255, 0.95)',
      // Bolder glow dropping down
      shadowColor: isDark ? '#A78BFA' : '#4F46E5',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.35 : 0.12,
      shadowRadius: 24,
      elevation: 12,
    }}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 55 : 95}
        tint={isDark ? "dark" : "light"}
        style={{
          flexDirection: 'row',
          paddingVertical: 8,
          paddingHorizontal: 8,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG.find(t => t.name === route.name);
          if (!config) return null;

          const isFocused = state.index === index;
          
          let color = isDark ? '#94A3B8' : '#64748B';
          if (isFocused) {
            color = isDark ? '#C084FC' : '#4F46E5'; // More vibrant lavender/violet on dark, rich deep indigo on light
          }

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(route.name)}
              style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 4 }}
            >
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 4,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: isFocused 
                  ? (isDark ? 'rgba(192, 132, 252, 0.18)' : 'rgba(99, 102, 241, 0.10)')
                  : 'transparent',
              }}>
                <MaterialIcons
                  name={config.icon}
                  size={22}
                  color={color}
                  style={{ marginBottom: 2 }}
                />
                <Text style={{ 
                  fontSize: 9, 
                  color: color, 
                  fontWeight: isFocused ? '900' : '700', // Bolder labels
                  letterSpacing: -0.2
                }}>
                  {config.label}
                </Text>
                {isFocused && (
                  <View style={{
                    position: 'absolute',
                    bottom: -2,
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isDark ? '#C084FC' : '#4F46E5',
                    shadowColor: isDark ? '#C084FC' : '#4F46E5',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 8,
                  }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}
