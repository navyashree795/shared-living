import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
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

  return (
    <View style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }}>
      <BlurView
        intensity={100}
        tint={isDark ? "dark" : "light"}
        style={{
          flexDirection: 'row',
          paddingTop: 12,
          paddingBottom: insets.bottom || 16,
          paddingHorizontal: 16,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        }}
      >
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG.find(t => t.name === route.name);
          if (!config) return null;

          const isFocused = state.index === index;
          
          let color = isDark ? '#64748B' : '#94A3B8';
          if (isFocused) {
            color = isDark ? '#FFFFFF' : '#0F172A';
          }

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(route.name)}
              style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}
            >
              <MaterialIcons
                name={config.icon}
                size={24}
                color={color}
                style={{ marginBottom: 4 }}
              />
              <Text style={{ fontSize: 11, color: color, fontWeight: isFocused ? '900' : '500' }}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}
