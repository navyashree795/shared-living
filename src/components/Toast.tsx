/*
 * FILE: src/components/Toast.tsx
 * PURPOSE: Global floating notification toast alert banner. Integrates reanimated slide-down
 *          spring transitions, status coloring styles (success, error, warn, info),
 *          and auto-dismiss schedules.
 * WHERE USED: Mounted once at the root level inside App.tsx.
 */

// Import React hooks and refs references
import React, { useEffect } from 'react';
// Import layout components, texts, touch buttons, and screen sizes
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
// Import Reanimated animation drivers and styles hooks
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS 
} from 'react-native-reanimated';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import toast context hook
import { useToast } from '../context/ToastContext';

const { width } = Dimensions.get('window');

const TOAST_HEIGHT = 60;
const TOP_OFFSET = 50;

const Toast: React.FC = () => {
  // Grab visibility parameters and messaging content from Toast context
  const { visible, message, type, hideToast } = useToast();
  // State parameter checking if layout should mount inside tree structure
  const [shouldRender, setShouldRender] = React.useState(false);
  
  // Shared animation value controlling horizontal translation offsets (starts off-screen at -100px)
  const translateY = useSharedValue(-100);

  // ─── TOAST POSITION SPRING TRANSITIONS ────────────────────────────────────
  // Triggers slide-down springs when visible status is true, and fades upward when false
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Spring bounce slide-down transition
      translateY.value = withSpring(TOP_OFFSET, {
        damping: 12,
        stiffness: 90,
      });
    } else {
      // Linear slide-up fade out transition
      translateY.value = withTiming(-100, { duration: 300 }, (finished) => {
        if (finished) {
          // Clean up DOM layout by unmounting component
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  // Compute animated style properties mapping
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    };
  });

  // Skip rendering if shouldRender flag is false
  if (!shouldRender) return null;

  // Retrieve matching alert icons and styling backgrounds
  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-500',
          icon: 'check-circle' as const,
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          icon: 'error' as const,
        };
      case 'warning':
        return {
          bg: 'bg-amber-500',
          icon: 'warning' as const,
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-500',
          icon: 'info' as const,
        };
    }
  };

  // Resolve active theme style tags
  const { bg, icon } = getToastStyles();

  return (
    // Render animated container
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 20,
          right: 20,
          zIndex: 9999,
          height: TOAST_HEIGHT,
        },
        animatedStyle,
      ]}
      className={`rounded-xl shadow-lg px-4 flex-row items-center justify-between ${bg}`}
    >
      <View className="flex-row items-center flex-1">
        <MaterialIcons name={icon} size={24} color="white" />
        <Text className="text-white font-semibold ml-3 text-base flex-1" numberOfLines={2}>
          {message}
        </Text>
      </View>
      {/* Manual close touch button */}
      <TouchableOpacity onPress={hideToast} className="ml-2">
        <MaterialIcons name="close" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default Toast;
