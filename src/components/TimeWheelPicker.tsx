import React, { useRef, useEffect, useState } from 'react';
import { View, Text, FlatList, Animated, NativeScrollEvent, NativeSyntheticEvent, Platform, TouchableOpacity, ScrollView } from 'react-native';

interface WheelPickerProps {
  data: string[];
  initialIndex: number;
  onSelect: (value: string) => void;
  width?: number;
}

const ITEM_HEIGHT = 38;
const VISIBLE_ITEMS = 3;

export const WheelPicker: React.FC<WheelPickerProps> = ({ data, initialIndex, onSelect, width = 60 }) => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useEffect(() => {
    // Small delay to ensure layout is ready
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: initialIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [initialIndex]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    if (index >= 0 && index < data.length) {
      setSelectedIndex(index);
      onSelect(data[index]);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width }} className="justify-center overflow-hidden">
      <View 
        className="absolute left-0 right-0 h-10 bg-primary/5 rounded-xl border-y border-primary/10" 
        style={{ top: ITEM_HEIGHT * 2 + 2 }}
      />
      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate={0.991} // Faster, more fluid deceleration
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onMomentumScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        scrollEventThrottle={16} // Standard 60fps throttle for better performance
        nestedScrollEnabled={true}
      >
        {data.map((item, index) => {
          const inputRange = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
          ];

          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.1, 0.4, 1, 0.4, 0.1],
            extrapolate: 'clamp',
          });

          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.9, 1, 1.2, 1, 0.9],
            extrapolate: 'clamp',
          });

          return (
            <View key={index} style={{ height: ITEM_HEIGHT, width }} className="items-center justify-center">
              <Animated.Text 
                style={{ opacity, transform: [{ scale }] }} 
                className="text-lg font-black text-slate-900"
              >
                {item}
              </Animated.Text>
            </View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
};

interface TimeWheelPickerProps {
  initialTime: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({ initialTime, onConfirm, onCancel }) => {
  const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
  const [minute, setMinute] = useState(initialTime.getMinutes());
  const [ampm, setAmPm] = useState(initialTime.getHours() >= 12 ? 'PM' : 'AM');

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ['AM', 'PM'];

  const handleConfirm = () => {
    const finalDate = new Date();
    let finalHour = hour;
    if (ampm === 'PM' && finalHour !== 12) finalHour += 12;
    if (ampm === 'AM' && finalHour === 12) finalHour = 0;
    finalDate.setHours(finalHour, minute, 0, 0);
    onConfirm(finalDate);
  };

  return (
    <View className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-2">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
          Time
        </Text>
        <TouchableOpacity 
          onPress={handleConfirm}
          className="bg-primary px-4 py-1.5 rounded-full"
        >
          <Text className="text-white font-black text-[10px] uppercase">Save</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-center h-[120px]">
        <WheelPicker 
          data={hours} 
          initialIndex={hour - 1} 
          onSelect={(v) => setHour(parseInt(v))} 
          width={50}
        />
        <Text className="text-xl font-black text-slate-300 mx-1">:</Text>
        <WheelPicker 
          data={minutes} 
          initialIndex={minute} 
          onSelect={(v) => {
             console.log('Min selected:', v);
             setMinute(parseInt(v));
          }} 
          width={55}
        />
        <View className="w-2" />
        <WheelPicker 
          data={periods} 
          initialIndex={periods.indexOf(ampm)} 
          onSelect={(v) => setAmPm(v)} 
          width={55}
        />
      </View>
    </View>
  );
};
