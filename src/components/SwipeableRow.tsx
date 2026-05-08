import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onComplete?: () => void;
  deleteLabel?: string;
  completeLabel?: string;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  onComplete,
  deleteLabel = 'Delete',
  completeLabel = 'Done',
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const close = () => swipeableRef.current?.close();

  const renderRightAction = (
    color: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    progress: Animated.AnimatedInterpolation<number>,
    onPress: () => void,
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View
        style={{
          transform: [{ translateX }],
          width: 76,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
          marginLeft: 4,
          borderRadius: 16,
          backgroundColor: color,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
          onPress={() => { close(); onPress(); }}
          activeOpacity={0.8}
        >
          <MaterialIcons name={icon} size={22} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      {onComplete && renderRightAction('#10B981', 'check-circle', completeLabel, progress, onComplete)}
      {onDelete && renderRightAction('#EF4444', 'delete-outline', deleteLabel, progress, onDelete)}
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={onDelete || onComplete ? renderRightActions : undefined}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
};

export default SwipeableRow;
