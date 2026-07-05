/*
 * FILE: src/components/BottomTabBar.tsx
 * PURPOSE: Custom bottom navigation tab menu bar. Features unread badging,
 *          handles device keyboard show/hide events, and highlights active routes.
 * WHERE USED: Screen navigation layouts in App.tsx.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React, { useState, useEffect } from 'react';
// Import UI layout components, touchable buttons, keyboard events, and style declarations
import { StyleSheet, View, Text, TouchableOpacity, Keyboard, Platform } from 'react-native';
// Import safe area context hooks to avoid notch clippings
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import theme hook
import { useTheme } from '../context/ThemeContext';

interface TabBarProps {
  // Array of active routes configs
  state: any;
  // Navigation actions triggers
  navigation: any;
  // Route details configurations descriptors
  descriptors: any;
  // Count of unread chat messages
  unreadCount?: number;
}

// Render BottomTabBar memoized to optimize re-renders
export const BottomTabBar = React.memo(({ 
  state, 
  navigation, 
  descriptors, 
  unreadCount = 0 
}: TabBarProps) => {
  // Retrieve notch insets
  const insets = useSafeAreaInsets();
  // Access global dark theme context
  const { isDark } = useTheme();
  // State parameter storing Boolean indicating if user keyboard is active
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Effect: Listen to hardware keyboard show/hide events to slide bottom tab bar away on inputs focus
  useEffect(() => {
    // Register listeners
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    // Clean up listeners on unmount
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Hide tab bar if keyboard overlay is visible
  if (keyboardVisible) {
    return null;
  }

  // Theme color styling variables mapping
  const activeColor = '#6366F1';
  const inactiveColor = isDark ? '#64748b' : '#94A3B8';
  const bgColor = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(99, 102, 241, 0.06)';

  return (
    // Outer floating container row wrapper
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: bgColor,
          borderColor: borderColor,
          // Shift bottom margin to pad device safe zones (notches)
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 12,
        }
      ]}
    >
      {/* Loop tabs inside current route state descriptors */}
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        // Resolve label name
        const label = options.tabBarLabel !== undefined
          ? options.tabBarLabel
          : options.title !== undefined
          ? options.title
          : route.name;

        // Verify if route tab is currently active
        const isFocused = state.index === index;

        // Navigation tab click handler
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        // Navigation tab long click handler
        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Helper resolving Material icons names matching tab names
        const getIconName = (name: string): keyof typeof MaterialIcons.glyphMap => {
          switch (name) {
            case 'Dashboard':
              return 'dashboard';
            case 'Grocery':
              return 'shopping-cart';
            case 'Expense':
              return 'account-balance-wallet';
            case 'Chores':
              return 'cleaning-services';
            case 'Chat':
              return 'forum';
            default:
              return 'help-outline';
          }
        };

        return (
          // Renders interactive touch button tab
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            {/* View container storing the icon */}
            <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
              <MaterialIcons 
                name={getIconName(route.name)} 
                size={22} 
                color={isFocused ? activeColor : inactiveColor} 
              />
              
              {/* If this is the Chat tab and there are unread messages, render a red badge overlay */}
              {route.name === 'Chat' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
            {/* Tab route description text label */}
            <Text 
              style={[
                styles.tabLabel, 
                { 
                  color: isFocused ? activeColor : inactiveColor,
                  fontWeight: isFocused ? '900' : '600'
                }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// Explicitly assign display name for React DevTools mapping
BottomTabBar.displayName = 'BottomTabBar';

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});

export default BottomTabBar;
