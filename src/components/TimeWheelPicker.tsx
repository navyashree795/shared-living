import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { View, Text, FlatList, Animated, NativeScrollEvent, NativeSyntheticEvent, Platform, TouchableOpacity } from 'react-native';

interface WheelPickerProps {
  data: string[];
  initialIndex: number;
  onSelect: (value: string) => void;
  width?: number;
}

const ITEM_HEIGHT = 45;
const VISIBLE_ITEMS = 3;

const PickerItem = memo(({ item, index, scrollY, width }: { item: string, index: number, scrollY: Animated.Value, width: number }) => {
  const opacity = scrollY.interpolate({
    inputRange: [
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
    ],
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  const scale = scrollY.interpolate({
    inputRange: [
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
    ],
    outputRange: [0.9, 1.1, 0.9],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ height: ITEM_HEIGHT, width }} className="items-center justify-center">
      <Animated.Text 
        style={{ opacity, transform: [{ scale }] }} 
        className="text-xl font-black text-slate-900"
      >
        {item}
      </Animated.Text>
    </View>
  );
});

export const WheelPicker: React.FC<WheelPickerProps> = memo(({ data, initialIndex, onSelect, width = 60 }) => {
  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_HEIGHT)).current;
  const flatListRef = useRef<FlatList>(null);
  
  // Track current index locally to avoid redundant updates
  const lastIndex = useRef(initialIndex);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const updateSelection = (y: number) => {
    const index = Math.round(y / ITEM_HEIGHT);
    if (index >= 0 && index < data.length && index !== lastIndex.current) {
      lastIndex.current = index;
      onSelect(data[index]);
    }
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateSelection(event.nativeEvent.contentOffset.y);
  };

  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // If it stops without momentum
    updateSelection(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width }} className="justify-center overflow-hidden">
      <View 
        className="absolute left-0 right-0 h-[45px] bg-primary/5 rounded-2xl border-y border-primary/10" 
        style={{ top: ITEM_HEIGHT }}
      />
      <Animated.FlatList
        ref={flatListRef}
        data={data}
        renderItem={({ item, index }) => (
          <PickerItem item={item} index={index} scrollY={scrollY} width={width} />
        )}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
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
        windowSize={3}
        maxToRenderPerBatch={5}
        removeClippedSubviews={true}
        nestedScrollEnabled={true}
      />
    </View>
  );
});

interface TimeWheelPickerProps {
  initialTime: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({ initialTime, onConfirm, onCancel }) => {
  // Use separate refs for selection to avoid closure issues with onSelect
  const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
  const [minute, setMinute] = useState(initialTime.getMinutes());
  const [ampm, setAmPm] = useState(initialTime.getHours() >= 12 ? 'PM' : 'AM');

  const hours = useRef(Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))).current;
  const minutes = useRef(Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))).current;
  const periods = useRef(['AM', 'PM']).current;

  const handleConfirm = () => {
    const finalDate = new Date();
    let finalHour = hour;
    if (ampm === 'PM' && finalHour !== 12) finalHour += 12;
    if (ampm === 'AM' && finalHour === 12) finalHour = 0;
    finalDate.setHours(finalHour, minute, 0, 0);
    onConfirm(finalDate);
  };

  const handleHourSelect = useCallback((v: string) => setHour(parseInt(v)), []);
  const handleMinuteSelect = useCallback((v: string) => setMinute(parseInt(v)), []);
  const handleAmPmSelect = useCallback((v: string) => setAmPm(v), []);

  return (
    <View className="bg-slate-50 rounded-[40px] p-6 border border-slate-200/50 shadow-xl">
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-slate-900 font-black text-xl tracking-tight">Time Picker</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-primary mr-1.5" />
            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Select Arrival</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={handleConfirm}
          className="bg-primary px-8 py-3.5 rounded-3xl shadow-lg shadow-primary/40 active:scale-95"
        >
          <Text className="text-white font-black text-sm uppercase tracking-widest">Set Time</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-center bg-white rounded-[32px] py-6 shadow-sm border border-slate-100">
        <WheelPicker 
          data={hours} 
          initialIndex={hour - 1} 
          onSelect={handleHourSelect} 
          width={70}
        />
        <View className="mx-1">
          <Text className="text-3xl font-black text-slate-200">:</Text>
        </View>
        <WheelPicker 
          data={minutes} 
          initialIndex={minute} 
          onSelect={handleMinuteSelect} 
          width={70}
        />
        <View className="w-3" />
        <WheelPicker 
          data={periods} 
          initialIndex={periods.indexOf(ampm)} 
          onSelect={handleAmPmSelect} 
          width={90}
        />
      </View>
    </View>
  );
};
