/*
 * FILE: src/components/SwipeableRow.tsx
 * PURPOSE: Gesture-swipeable row container wrapper. Reveals animated control buttons (Edit, Delete)
 *          when swiping right, and triggers quick completions when swiping left.
 * WHERE USED: Chores checklist feeds, transactions history items, and shopping lists rows.
 */

// Import React hooks and refs references
import React, { useRef } from 'react';
// Import layout components, texts, touch buttons, and animated interpolation modules
import { View, Text, TouchableOpacity, Animated } from 'react-native';
// Import gesture swipe wrapper component from standard library
import { Swipeable } from 'react-native-gesture-handler';
// Import vector icons
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
  // Swipeable gesture ref to trigger programmatic drawer closes
  const swipeableRef = useRef<Swipeable>(null);

  // Helper function to force-close swipeable drawer state
  const close = () => swipeableRef.current?.close();

  // ─── SWIPE ACTION BUTTON BUILDER ──────────────────────────────────────────
  // Creates an animated button overlay block that translates into view based on swipe progress
  const renderAction = (
    color: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    progress: Animated.AnimatedInterpolation<number>,
    onPress: () => void,
    isLeft: boolean = false
  ) => {
    // Translate action block horizontally based on gesture progress
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [isLeft ? -80 : 80, 0],
    });
    
    return (
      // Animated slide button container
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
        {/* Trigger touch callbacks and close the drawer simultaneously */}
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

  // Right-swipe buttons drawer (Edit & Delete options)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      {/* If edit handler exists, draw edit button */}
      {onEdit && renderAction('rgba(99, 102, 241, 0.8)', 'edit', editLabel, progress, onEdit)}
      {/* If delete handler exists, draw delete button */}
      {onDelete && renderAction('#EF4444', 'delete-outline', deleteLabel, progress, onDelete)}
    </View>
  );

  // Left-swipe button drawer (Complete / Check off task option)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
      {/* If complete handler exists, draw complete/bought/rotate action button */}
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
    // Render native gesture row container
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
      {/* Nested rows layout children */}
      {children}
    </Swipeable>
  );
};

export default SwipeableRow;
