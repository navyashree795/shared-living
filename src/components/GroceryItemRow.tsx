/*
 * FILE: src/components/GroceryItemRow.tsx
 * PURPOSE: Row component for grocery checklist items. Contains checkbox spring bounces,
 *          scratch-off text strikethrough animations, expandable options drawers, and quick
 *          split ledger prompts.
 * WHERE USED: Loaded inside FlatList row rendering inside GroceryScreen.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React, { useState, useEffect, useRef } from 'react';
// Import layout components, texts, touch triggers, animated values, and native systems
import {
  View, Text, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager
} from 'react-native';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import custom types schemas
import { GroceryItem } from '../types';
// Import swipeable row drawer wrapper component
import SwipeableRow from './SwipeableRow';

// Enable experimental layout animations on Android devices to handle smooth height transitions
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface Category {
  id: string;
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  bg: string;
  color: string;
}

// Global category details mapping icons and custom badge styles
export const CATEGORIES: Category[] = [
  { id: 'produce', name: 'Fresh Produce', icon: 'eco', bg: '#059669', color: '#FFFFFF' },
  { id: 'dairy', name: 'Dairy & Chilled', icon: 'coffee', bg: '#0284C7', color: '#FFFFFF' },
  { id: 'meat', name: 'Meat & Seafood', icon: 'restaurant', bg: '#E11D48', color: '#FFFFFF' },
  { id: 'staples', name: 'Kitchen Staples', icon: 'bakery-dining', bg: '#CA8A04', color: '#FFFFFF' },
  { id: 'essentials', name: 'Home Essentials', icon: 'auto-awesome', bg: '#7C3AED', color: '#FFFFFF' },
  { id: 'drinks', name: 'Drinks & Spirits', icon: 'local-bar', bg: '#475569', color: '#FFFFFF' },
  { id: 'misc', name: 'Miscellaneous', icon: 'inventory', bg: '#6B7280', color: '#FFFFFF' },
];

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggle: (item: GroceryItem) => void;
  onDelete: (id: string) => void;
  onEdit: (item: GroceryItem) => void;
  onLogExpense: (item: GroceryItem) => void;
  isDark: boolean;
}

export default function GroceryItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
  onLogExpense,
  isDark
}: GroceryItemRowProps) {
  // Option drawer expanded toggler state parameter
  const [expanded, setExpanded] = useState(false);
  
  // ─── CHECKBOX & CHECK STRIKE ANIMATION DEFINITIONS ────────────────────────
  // Animation scale driver for checkbox click triggers
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Width percentage mapping for strikethrough scratch-off animations
  const scratchWidthAnim = useRef(new Animated.Value(item.done ? 1 : 0)).current;
  // Row opacity level animation driver
  const opacityAnim = useRef(new Animated.Value(item.done ? 0.65 : 1)).current;
  // Tracker mapping last completed value to avoid recursive springs loops
  const lastDone = useRef(item.done);

  // Trigger scratch strike and opacity fades when checked status changes
  useEffect(() => {
    Animated.parallel([
      // Animate the text strikethrough line width percentage from 0 to 100%
      Animated.timing(scratchWidthAnim, {
        toValue: item.done ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      // Animate row opacity levels
      Animated.timing(opacityAnim, {
        toValue: item.done ? 0.65 : 1,
        duration: 250,
        useNativeDriver: false,
      })
    ]).start();

    // Trigger checkbox bounce sequence only on value toggles
    if (item.done !== lastDone.current) {
      lastDone.current = item.done;
      scaleAnim.setValue(1);
      Animated.sequence([
        // Step 1: Shrink the bubble down to 75% scale quickly
        Animated.timing(scaleAnim, { toValue: 0.75, duration: 80, useNativeDriver: true }),
        // Step 2: Spring pop the scale outward to 120%
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
        // Step 3: Calm the bubble back down to standard 100% size
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [item.done]);

  // Handle standard checkbox clicking gesture updates
  const handleCheckboxPress = () => {
    scaleAnim.setValue(1);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.75, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle(item);
  };

  // Toggle item action drawer with smooth presets layout transitions
  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  // Match items category code to details object
  const category = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];

  return (
    // Wrap row inside swipeable drawer actions components
    <SwipeableRow
      onDelete={() => onDelete(item.id)}
      onComplete={!item.done ? () => onToggle(item) : undefined}
      completeLabel="Bought"
    >
      <Animated.View
        style={{
          // Dim background if item is checked
          backgroundColor: item.done
            ? (isDark ? 'rgba(22, 27, 51, 0.4)' : '#F8FAFC')
            : (isDark ? '#161B33' : '#FFFFFF'),
          borderRadius: 24,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: item.done
            ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(99, 102, 241, 0.03)')
            : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(99, 102, 241, 0.05)'),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: item.done ? 0 : (isDark ? 0 : 0.05),
          shadowRadius: 8,
          elevation: item.done ? 0 : 2,
          opacity: opacityAnim
        }}
      >
        <View className="flex-row items-center">
          {/* Check Circle Checkbox */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity className="mr-3" onPress={handleCheckboxPress}>
              <MaterialIcons
                name={item.done ? "check-circle" : "radio-button-unchecked"}
                size={26}
                color={item.done ? "#10B981" : (isDark ? '#475569' : '#CBD5E1')}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Category Icon Bubble */}
          <View
            style={{
              backgroundColor: item.done
                ? (isDark ? 'rgba(255, 255, 255, 0.02)' : '#E2E8F0')
                : (isDark ? 'rgba(255, 255, 255, 0.05)' : category.bg),
              borderColor: isDark ? category.bg : 'transparent',
              borderWidth: isDark ? 1 : 0
            }}
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          >
            <MaterialIcons
              name={category.icon}
              size={20}
              color={item.done
                ? (isDark ? '#475569' : '#64748B')
                : (isDark ? category.bg : category.color)}
            />
          </View>

          {/* Item details and scratch-off line animations */}
          <View className="flex-1">
            <View className="flex-row items-baseline">
              <View style={{ alignSelf: 'flex-start', position: 'relative' }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: item.done
                      ? (isDark ? '#64748B' : '#94A3B8')
                      : (isDark ? '#F1F5F9' : '#1E1B4B')
                  }}
                >
                  {item.name}
                </Text>
                
                {/* Strike-out line container */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '55%',
                    height: 1.5,
                    backgroundColor: isDark ? '#A78BFA' : '#4F46E5',
                    width: scratchWidthAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }}
                />
              </View>
              {/* Optional Quantity metadata field */}
              {item.qty ? (
                <Text
                  style={{ color: item.done ? (isDark ? '#475569' : '#94A3B8') : '#6366F1' }}
                  className="text-[11px] font-black ml-2 uppercase tracking-tight"
                >
                  {item.qty}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-[10px] text-textMuted font-bold uppercase tracking-widest mr-2">
                {category.name}
              </Text>
              {item.price > 0 && (
                <Text className="text-[10px] text-textMuted font-bold uppercase">
                  ·  ₹{item.price.toFixed(2)}
                </Text>
              )}
            </View>
          </View>

          {/* Expand Options Menu Button */}
          <TouchableOpacity onPress={toggleExpanded} className="p-2 ml-1 bg-surface/50 rounded-full">
            <MaterialIcons
              name={expanded ? "close" : "more-horiz"}
              size={20}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        </View>

        {/* Expandable Options Drawer Layout */}
        {expanded && (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            {/* Mark Bought/Put back toggle */}
            {item.done ? (
              <TouchableOpacity
                onPress={() => { toggleExpanded(); onToggle(item); }}
                className="flex-row items-center px-3 py-2 rounded-xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#E6F4EA',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }}
              >
                <MaterialIcons name="undo" size={14} color="#10B981" />
                <Text className="text-[11px] font-bold ml-1.5 text-[#10B981]">Put Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { toggleExpanded(); onToggle(item); }}
                className="flex-row items-center px-3 py-2 rounded-xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#E6F4EA',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }}
              >
                <MaterialIcons name="check" size={14} color="#10B981" />
                <Text className="text-[11px] font-bold ml-1.5 text-[#10B981]">Mark Bought</Text>
              </TouchableOpacity>
            )}

            {/* Log to expenses trigger */}
            {item.done && !item.expenseLogged && (
              <TouchableOpacity
                onPress={() => { toggleExpanded(); onLogExpense(item); }}
                className="flex-row items-center px-3 py-2 rounded-xl border"
                style={{
                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.1)' : '#F3E8FF',
                  borderColor: 'rgba(124, 58, 237, 0.3)'
                }}
              >
                <MaterialIcons name="account-balance-wallet" size={14} color="#8B5CF6" />
                <Text className="text-[11px] font-bold ml-1.5 text-[#8B5CF6]">Log Expense</Text>
              </TouchableOpacity>
            )}

            {/* Edit details */}
            <TouchableOpacity
              onPress={() => { toggleExpanded(); onEdit(item); }}
              className="flex-row items-center px-3 py-2 rounded-xl border"
              style={{
                backgroundColor: isDark ? 'rgba(217, 119, 6, 0.1)' : '#FEF3C7',
                borderColor: 'rgba(217, 119, 6, 0.3)'
              }}
            >
              <MaterialIcons name="edit" size={14} color="#D97706" />
              <Text className="text-[11px] font-bold ml-1.5 text-[#D97706]">Edit Details</Text>
            </TouchableOpacity>

            {/* Delete row */}
            <TouchableOpacity
              onPress={() => { toggleExpanded(); onDelete(item.id); }}
              className="flex-row items-center px-3 py-2 rounded-xl border"
              style={{
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
                borderColor: 'rgba(239, 68, 68, 0.3)'
              }}
            >
              <MaterialIcons name="delete-outline" size={14} color="#EF4444" />
              <Text className="text-[11px] font-bold ml-1.5 text-[#EF4444]">Delete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Inline log to expenses quick trigger (shown when item is checked out and has a price assigned) */}
        {!expanded && item.done && item.price > 0 && !item.expenseLogged && (
          <View className="mt-3 pt-3 border-t border-border/50 flex-row items-center justify-between">
            <Text className="text-xs text-textMuted font-medium pr-4 flex-1">
              You bought this for <Text className="font-bold text-textMain">₹{item.price}</Text>. Log it to household expenses?
            </Text>
            <TouchableOpacity
              onPress={() => onLogExpense(item)}
              className="bg-primary px-3 py-2 rounded-xl flex-row items-center shadow-sm"
            >
              <MaterialIcons name="account-balance-wallet" size={14} color="#FFF" />
              <Text className="text-white text-[10px] font-bold ml-1.5 uppercase tracking-wider">Log</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status logged notification badge */}
        {!expanded && item.done && item.expenseLogged && (
          <View className="mt-3 pt-3 border-t border-border/50 flex-row items-center">
            <MaterialIcons name="verified" size={14} color="#10B981" />
            <Text className="text-xs text-success font-bold ml-1">Logged to Expenses</Text>
          </View>
        )}
      </Animated.View>
    </SwipeableRow>
  );
}
