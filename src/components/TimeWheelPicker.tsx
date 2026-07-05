/*
 * FILE: src/components/TimeWheelPicker.tsx
 * PURPOSE: Interactive scrollable wheel time picker dial. Includes three independent drums
 *          (Hour, Minute, AM/PM) aligning snap offsets, scaling aligned text entries,
 *          and compiling final Date objects.
 * WHERE USED: Loaded inside a Modal popup inside ChoresScreen.
 */

// Import React hooks and refs references
import React, { useRef, useState, memo, useCallback, useEffect } from "react";
// Import layout components, flat lists, and animation drivers
import { View, Text, FlatList, Animated, NativeScrollEvent, NativeSyntheticEvent, TouchableOpacity } from "react-native";
// Import theme hook
import { useTheme } from "../context/ThemeContext";

interface WheelPickerProps {
  data: string[];
  initialIndex: number;
  onSelect: (value: string) => void;
  width?: number;
  isDark?: boolean;
}

const ITEM_HEIGHT = 45;
const VISIBLE_ITEMS = 3;

// ─── DRUM PICKER ITEM RENDERER ─────────────────────────────────────────────
// Renders individual text elements inside the drum, scaling and fading items as they approach the center highlight slot
const PickerItem = memo(({ item, index, scrollY, width, textColor }: { item: string; index: number; scrollY: Animated.Value; width: number; textColor: string }) => {
  // Interpolate opacity based on scroll distance from highlight slot (fade non-selected options to 30% opacity)
  const opacity = scrollY.interpolate({
    inputRange: [
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
    ],
    outputRange: [0.3, 1, 0.3],
    extrapolate: "clamp",
  });

  // Interpolate scaling zoom factor (magnify active choice by 10%)
  const scale = scrollY.interpolate({
    inputRange: [
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
    ],
    outputRange: [0.9, 1.1, 0.9],
    extrapolate: "clamp",
  });

  return (
    // Render drum row element
    <View style={{ height: ITEM_HEIGHT, width }} className="items-center justify-center">
      <Animated.Text 
        style={{ opacity, transform: [{ scale }], color: textColor }} 
        className="text-xl font-black"
      >
        {item}
      </Animated.Text>
    </View>
  );
});
PickerItem.displayName = "PickerItem";

// ─── INDEPENDENT DRUM PICKER WHEEL ─────────────────────────────────────────
// A snap-scrolling column FlatList representing a single time component (e.g. minutes)
export const WheelPicker: React.FC<WheelPickerProps> = memo(({ data, initialIndex, onSelect, width = 60, isDark = false }) => {
  // Animation driver tracking scroll Y offsets
  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_HEIGHT)).current;
  // Reference targeting FlatList for scroll manipulations
  const flatListRef = useRef<FlatList>(null);
  // Ref backing current selection index
  const lastIndex = useRef(initialIndex);

  // Force physical scroll alignment to target initial index value after layout mounts
  const initialIndexRef = useRef(initialIndex);
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: initialIndexRef.current * ITEM_HEIGHT,
        animated: false,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Map FlatList scroll events to our Animated.Value
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  // Calculate chosen index value based Y offsets
  const updateSelection = (y: number) => {
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < data.length && index !== lastIndex.current) {
      lastIndex.current = index;
      onSelect(data[index]);
    }
  };

  // Triggers selection updates when scrolling momentum finishes
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateSelection(event.nativeEvent.contentOffset.y);
  };

  // Triggers selection updates when dragging actions finish
  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateSelection(event.nativeEvent.contentOffset.y);
  };

  const highlightBg = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(99, 102, 241, 0.05)";
  const highlightBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(99, 102, 241, 0.1)";

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width }} className="justify-center overflow-hidden">
      {/* Selection border highlight overlay panel */}
      <View 
        style={{ 
          top: ITEM_HEIGHT,
          backgroundColor: highlightBg,
          borderColor: highlightBorder
        }}
        className="absolute left-0 right-0 h-[45px] rounded-2xl border-y" 
      />
      {/* Scrollable list representation */}
      <Animated.FlatList
        ref={flatListRef}
        data={data}
        renderItem={({ item, index }) => (
          <PickerItem item={item} index={index} scrollY={scrollY} width={width} textColor={isDark ? "#F1F5F9" : "#0F172A"} />
        )}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        // Force list scrolling to align directly to item heights intervals
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 50);
        }}
        windowSize={3}
        maxToRenderPerBatch={5}
        removeClippedSubviews={true}
        nestedScrollEnabled={true}
      />
    </View>
  );
});
WheelPicker.displayName = "WheelPicker";

interface TimeWheelPickerProps {
  initialTime: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

// ─── THREE-DRUM CLOCK TIME WHEEL PICKER ────────────────────────────────────
// Combines Hours, Minutes, and AM/PM wheels. Cache current state variables in mutable React refs 
// during active scrolling events to keep scroll gestures completely lag-free.
export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({ initialTime, onConfirm, onCancel }) => {
  // Retrieve global dark theme context
  const { isDark } = useTheme();
  
  // Use separate refs for selection to prevent lag during active dragging gestures
  const selectedHour = useRef(initialTime.getHours() % 12 || 12);
  const selectedMinute = useRef(initialTime.getMinutes());
  const selectedAmPm = useRef(initialTime.getHours() >= 12 ? 'PM' : 'AM');

  // Lists configurations
  const hours = useRef(Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))).current;
  const minutes = useRef(Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))).current;
  const periods = useRef(["AM", "PM"]).current;

  // Compile final Date based on selections
  const handleConfirm = () => {
    const finalDate = new Date();
    let finalHour = selectedHour.current;
    if (selectedAmPm.current === 'PM' && finalHour !== 12) finalHour += 12;
    if (selectedAmPm.current === 'AM' && finalHour === 12) finalHour = 0;
    // Set hours and minutes values
    finalDate.setHours(finalHour, selectedMinute.current, 0, 0);
    onConfirm(finalDate);
  };

  const handleHourSelect = useCallback((v: string) => {
    selectedHour.current = parseInt(v);
  }, []);
  
  const handleMinuteSelect = useCallback((v: string) => {
    selectedMinute.current = parseInt(v);
  }, []);
  
  const handleAmPmSelect = useCallback((v: string) => {
    selectedAmPm.current = v;
  }, []);

  const cardBg = isDark ? "#111827" : "#F8FAFC";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  const innerBg = isDark ? "#0F1320" : "#FFFFFF";
  const innerBorder = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const textMain = isDark ? "#F1F5F9" : "#0F172A";
  const textMuted = isDark ? "#94A3B8" : "#64748B";
  const primary = isDark ? "#818CF8" : "#4F46E5";

  return (
    <View style={{ backgroundColor: cardBg, borderColor: border, borderWidth: 1 }} className="rounded-[40px] p-6 shadow-xl">
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text style={{ color: textMain }} className="font-black text-xl tracking-tight">Time Picker</Text>
          <View className="flex-row items-center mt-0.5">
            <View style={{ backgroundColor: primary }} className="w-2 h-2 rounded-full mr-1.5" />
            <Text style={{ color: textMuted }} className="text-[10px] font-black uppercase tracking-widest">Select Time</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={handleConfirm}
          style={{ backgroundColor: primary }}
          className="px-8 py-3.5 rounded-3xl shadow-lg active:scale-95"
        >
          <Text className="text-white font-black text-sm uppercase tracking-widest">Set Time</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: innerBg, borderColor: innerBorder, borderWidth: 1 }} className="flex-row items-center justify-center rounded-[32px] py-6 shadow-sm">
        {/* Hour Drum */}
        <WheelPicker 
          data={hours} 
          initialIndex={selectedHour.current - 1} 
          onSelect={handleHourSelect} 
          width={70}
          isDark={isDark}
        />
        <View className="mx-1">
          <Text style={{ color: isDark ? "rgba(255,255,255,0.15)" : "#E2E8F0" }} className="text-3xl font-black">:</Text>
        </View>
        {/* Minute Drum */}
        <WheelPicker 
          data={minutes} 
          initialIndex={selectedMinute.current} 
          onSelect={handleMinuteSelect} 
          width={70}
          isDark={isDark}
        />
        <View className="w-3" />
        {/* AM/PM Drum */}
        <WheelPicker 
          data={periods} 
          initialIndex={periods.indexOf(selectedAmPm.current)} 
          onSelect={handleAmPmSelect} 
          width={90}
          isDark={isDark}
        />
      </View>
    </View>
  );
};
