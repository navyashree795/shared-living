/*
 * FILE: src/components/Skeleton.tsx
 * PURPOSE: Loading placeholder card displaying shimmering gradient animation loops.
 * WHERE USED: Screen loading transitions before Firestore sync events complete.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React, { useEffect, useRef } from 'react';
// Import layout components, style sheets, and animation drivers
import { View, StyleSheet, Animated, DimensionValue, ViewStyle } from 'react-native';
// Import linear gradients library
import { LinearGradient } from 'expo-linear-gradient';
// Import theme hook
import { useTheme } from '../context/ThemeContext';

interface SkeletonProps {
  // Width bounds
  width?: DimensionValue;
  // Height bounds
  height?: DimensionValue;
  // Circular radius properties (e.g. for avatar skeleton placeholders)
  borderRadius?: number;
  // Style properties overrides
  style?: ViewStyle;
}

// Render Skeleton placeholder
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}) => {
  // Access global dark theme context
  const { isDark } = useTheme();
  
  // Animation driver managing transition offset coordinates (between -1 and 1)
  const shimmerValue = useRef(new Animated.Value(-1)).current;

  // Effect: Start infinite shimmer looping sequence on mount
  useEffect(() => {
    // Shimmer sweep animation details
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    
    // Start loop
    shimmerAnimation.start();

    // Clean up loop on unmount
    return () => shimmerAnimation.stop();
  }, [shimmerValue]);

  // Interpolate numerical bounds to percentage translates
  const translateX = shimmerValue.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  // Resolve color palettes based on active theme
  const baseColor = isDark ? '#1E293B' : '#E2E8F0';
  const highlightColor = isDark ? '#334155' : '#F1F5F9';

  return (
    // Outer skeleton container
    <View 
      style={[
        styles.skeletonContainer, 
        { 
          width, 
          height, 
          borderRadius, 
          backgroundColor: baseColor 
        }, 
        style
      ]}
    >
      {/* Absolute floating overlay container mapping translate animations */}
      <Animated.View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            transform: [{ translateX }] 
          }
        ]}
      >
        {/* Draw diagonal shimmering highlights */}
        <LinearGradient
          colors={[baseColor, highlightColor, baseColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  skeletonContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
});

// Specialized Chore item loading placeholder skeleton
export const ChoreSkeleton = () => (
  // Outer card container matching chores list items styles
  <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
    {/* Circular checkbox placeholder */}
    <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 12 }} />
    <View className="flex-1">
      {/* Title text placeholder line */}
      <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
      <View className="flex-row">
        {/* Date and assignee tags placeholders */}
        <Skeleton width={80} height={12} borderRadius={4} style={{ marginRight: 8 }} />
        <Skeleton width={60} height={12} borderRadius={4} />
      </View>
    </View>
    {/* Action icon placeholder */}
    <Skeleton width={24} height={24} borderRadius={4} style={{ marginLeft: 8 }} />
  </View>
);

// Specialized Expense ledger loading placeholder skeleton
export const ExpenseSkeleton = () => (
  // Outer card container matching transactions items styles
  <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
    {/* Category avatar bubble placeholder */}
    <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
    <View className="flex-1">
      {/* Title text placeholder line */}
      <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
      {/* Date metadata placeholder line */}
      <Skeleton width="40%" height={12} />
    </View>
    {/* Amount pricing indicators placeholders */}
    <View className="items-end">
      <Skeleton width={50} height={18} style={{ marginBottom: 4 }} />
      <Skeleton width={40} height={10} />
    </View>
  </View>
);

// Specialized Household details loading placeholder skeleton
export const HouseholdSkeleton = () => (
  // Outer row container matching switcher selections items styles
  <View className="bg-white rounded-[32px] p-6 mb-4 border border-border shadow-sm flex-row items-center">
    {/* Icon identifier placeholder */}
    <Skeleton width={48} height={48} borderRadius={16} style={{ marginRight: 16 }} />
    <View className="flex-1">
      {/* Main name placeholder line */}
      <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
      {/* Description text placeholder line */}
      <Skeleton width="30%" height={14} />
    </View>
    {/* Switch checkbox bubble placeholder */}
    <Skeleton width={24} height={24} borderRadius={12} />
  </View>
);

// Specialized Activity logger feed loading placeholder skeleton
export const ActivitySkeleton = () => (
  // Outer horizontal row card placeholder matching activity timeline entries
  <View className="bg-slate-50 p-4 rounded-[28px] mr-3 border border-slate-100 flex-row items-center gap-4 min-w-[240px]">
    {/* Category indicator icon bubble placeholder */}
    <Skeleton width={40} height={40} borderRadius={16} />
    <View className="flex-1">
      {/* Summary message line placeholder */}
      <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
      {/* Time duration placeholder */}
      <Skeleton width="40%" height={10} />
    </View>
  </View>
);
