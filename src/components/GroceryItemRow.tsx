import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GroceryItem } from '../types';
import SwipeableRow from './SwipeableRow';

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
  const [expanded, setExpanded] = useState(false);
  
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scratchWidthAnim = useRef(new Animated.Value(item.done ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(item.done ? 0.65 : 1)).current;
  const lastDone = useRef(item.done);

  useEffect(() => {
    // Scratch and opacity animations
    Animated.parallel([
      Animated.timing(scratchWidthAnim, {
        toValue: item.done ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: item.done ? 0.65 : 1,
        duration: 250,
        useNativeDriver: false,
      })
    ]).start();

    // Checkbox spring bounce on transition
    if (item.done !== lastDone.current) {
      lastDone.current = item.done;
      scaleAnim.setValue(1);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.75, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [item.done]);

  const handleCheckboxPress = () => {
    scaleAnim.setValue(1);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.75, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, tension: 40, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onToggle(item);
  };

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const category = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <SwipeableRow
      onDelete={() => onDelete(item.id)}
      onComplete={!item.done ? () => onToggle(item) : undefined}
      completeLabel="Bought"
    >
      <Animated.View
        style={{
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
          {/* Animated Check Circle */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity className="mr-3" onPress={handleCheckboxPress}>
              <MaterialIcons
                name={item.done ? "check-circle" : "radio-button-unchecked"}
                size={26}
                color={item.done ? "#10B981" : (isDark ? '#475569' : '#CBD5E1')}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Category Icon */}
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

          {/* Details */}
          <View className="flex-1">
            <View className="flex-row items-baseline">
              {/* Name wrapper for animated scratch line */}
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
                {/* Scratch-off Line Animation */}
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

          {/* Options Menu Toggle */}
          <TouchableOpacity onPress={toggleExpanded} className="p-2 ml-1 bg-surface/50 rounded-full">
            <MaterialIcons
              name={expanded ? "close" : "more-horiz"}
              size={20}
              color={isDark ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        </View>

        {/* Expandable Options Drawer */}
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

        {/* Regular Action Panel (Inline Option) if not expanded */}
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
