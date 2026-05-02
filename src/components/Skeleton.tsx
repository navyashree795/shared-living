import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewProps } from 'react-native';

interface SkeletonProps extends ViewProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, borderRadius = 8, style, ...props }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      {...props}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB', // bg-gray-200
          opacity,
        },
        style,
      ]}
    />
  );
};

export const ChoreSkeleton = () => (
  <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
    <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 12 }} />
    <View className="flex-1">
      <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} />
      <View className="flex-row">
        <Skeleton width={80} height={12} borderRadius={4} style={{ marginRight: 8 }} />
        <Skeleton width={60} height={12} borderRadius={4} />
      </View>
    </View>
    <Skeleton width={24} height={24} borderRadius={4} style={{ marginLeft: 8 }} />
  </View>
);

export const ExpenseSkeleton = () => (
  <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 border border-border shadow-sm">
    <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
    <View className="flex-1">
      <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={12} />
    </View>
    <View className="items-end">
      <Skeleton width={50} height={18} style={{ marginBottom: 4 }} />
      <Skeleton width={40} height={10} />
    </View>
  </View>
);

export const HouseholdSkeleton = () => (
  <View className="bg-white rounded-[32px] p-6 mb-4 border border-border shadow-sm flex-row items-center">
    <Skeleton width={48} height={48} borderRadius={16} style={{ marginRight: 16 }} />
    <View className="flex-1">
      <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="30%" height={14} />
    </View>
    <Skeleton width={24} height={24} borderRadius={12} />
  </View>
);

export const ActivitySkeleton = () => (
  <View className="bg-slate-50 p-4 rounded-[28px] mr-3 border border-slate-100 flex-row items-center gap-4 min-w-[240px]">
    <Skeleton width={40} height={40} borderRadius={16} />
    <View className="flex-1">
      <Skeleton width="80%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="40%" height={10} />
    </View>
  </View>
);
