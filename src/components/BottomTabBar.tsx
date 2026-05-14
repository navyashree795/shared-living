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
  { name: 'Grocery',   icon: 'shopping-bag', label: 'Grocery' },
  { name: 'Expenses',  icon: 'attach-money', label: 'Expenses' },
  { name: 'Chores',    icon: 'check-box', label: 'Chores' },
  { name: 'Chat',      icon: 'chat-bubble-outline', label: 'Chat' },
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
      bottom: 0,
      left: 0,
      right: 0,
      height: 75 + insets.bottom,
      backgroundColor: isDark ? '#07080F' : '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      flexDirection: 'row',
      paddingBottom: insets.bottom,
    }}>
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG.find(t => t.name === route.name);
        if (!config) return null;

        const isFocused = state.index === index;
        const color = isFocused 
          ? (isDark ? '#818CF8' : '#4F46E5') 
          : (isDark ? '#4B5563' : '#94A3B8');

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <MaterialIcons
                name={config.icon as any}
                size={26}
                color={color}
              />
              <Text style={{ 
                fontSize: 10, 
                color: color, 
                fontWeight: isFocused ? '700' : '500',
                marginTop: 4,
              }}>
                {config.label}
              </Text>
              {isFocused && (
                <View style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: color,
                  marginTop: 6,
                }} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
