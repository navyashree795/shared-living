import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  runOnJS 
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../context/ToastContext';

const { width } = Dimensions.get('window');

const TOAST_HEIGHT = 60;
const TOP_OFFSET = 50;

const Toast: React.FC = () => {
  const { visible, message, type, hideToast } = useToast();
  const [shouldRender, setShouldRender] = React.useState(false);
  const translateY = useSharedValue(-100);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      translateY.value = withSpring(TOP_OFFSET, {
        damping: 12,
        stiffness: 90,
      });
    } else {
      translateY.value = withTiming(-100, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    };
  });

  if (!shouldRender) return null;

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

  const { bg, icon } = getToastStyles();

  return (
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
      <TouchableOpacity onPress={hideToast} className="ml-2">
        <MaterialIcons name="close" size={20} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default Toast;
