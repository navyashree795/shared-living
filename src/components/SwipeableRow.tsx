import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onEdit?: () => void;
  onComplete?: () => void;
  isRotation?: boolean;
  deleteLabel?: string;
  editLabel?: string;
  completeLabel?: string;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  onDelete,
  onEdit,
  onComplete,
  isRotation,
  deleteLabel = 'Delete',
  editLabel = 'Edit',
  completeLabel = 'Done',
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const close = () => swipeableRef.current?.close();

  const renderAction = (
    color: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    progress: Animated.AnimatedInterpolation<number>,
    onPress: () => void,
    isLeft: boolean = false
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [isLeft ? -80 : 80, 0],
    });
    return (
      <Animated.View
        style={{
          transform: [{ translateX }],
          width: 76,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
          marginHorizontal: 4,
          borderRadius: 20,
          backgroundColor: color,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}
          onPress={() => { close(); onPress(); }}
          activeOpacity={0.8}
        >
          <MaterialIcons name={icon} size={24} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
      {onEdit && renderAction('rgba(99, 102, 241, 0.8)', 'edit', editLabel, progress, onEdit)}
      {onDelete && renderAction('#EF4444', 'delete-outline', deleteLabel, progress, onDelete)}
    </View>
  );

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
      {onComplete && renderAction(
        isRotation ? '#3B82F6' : '#10B981', 
        isRotation ? 'loop' : 'check-circle', 
        isRotation ? 'Rotate' : completeLabel, 
        progress, 
        onComplete, 
        true
      )}
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={onDelete || onEdit ? renderRightActions : undefined}
      renderLeftActions={onComplete ? renderLeftActions : undefined}
      onSwipeableLeftOpen={onComplete}
      rightThreshold={40}
      leftThreshold={40}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      activeOffsetX={[-10, 10]}
      failOffsetY={[-15, 15]}
    >
      {children}
    </Swipeable>
  );
};

export default SwipeableRow;
