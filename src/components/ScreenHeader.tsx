/*
 * FILE: src/components/ScreenHeader.tsx
 * PURPOSE: Standardized header navbar rendering back arrows, main titles, and customizable
 *          right action slots. Supports legacy navigation props for backward compatibility.
 * WHERE USED: Screen layouts (Grocery, Chores, Expense, Chat screens) to align header elements consistently.
 */

// Import React components references
import React from 'react';
// Import layout components, texts, touch buttons, and style variables
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
// Import safe area notch padding hook
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import theme hook
import { useTheme } from '../context/ThemeContext';

interface ScreenHeaderProps {
  // Main title string
  title: string;
  // Optional back navigation callback
  onBackPress?: () => void;
  // Optional component to render in the right action slot
  rightAction?: React.ReactNode;
  
  // Legacy / fallback props for backward compatibility:
  navigation?: any;
  hideBack?: boolean;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIconColor?: string;
  rightIconBg?: string;
  rightIconBorder?: string;
  onRightPress?: () => void;
  children?: React.ReactNode;
}

// Render ScreenHeader component
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ 
  title, 
  onBackPress, 
  rightAction,
  navigation,
  hideBack = false,
  rightIcon,
  rightIconColor,
  rightIconBg,
  rightIconBorder,
  onRightPress,
  children
}) => {
  // Retrieve safe area notch height inset
  const insets = useSafeAreaInsets();
  // Access global dark theme context
  const { isDark } = useTheme();

  // Theme color styling variables mapping
  const textColor = isDark ? '#F1F5F9' : '#1A1D3B';
  const borderBottomColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#EEF2FF';

  // Handle back button click triggers (uses custom callback or falls back to navigation goBack)
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  // Determine if back button should be drawn
  const shouldShowBack = !hideBack && (!!onBackPress || !!navigation);

  return (
    // Outer view adding top safe areas
    <View 
      style={[
        styles.headerContainer, 
        { 
          paddingTop: Math.max(insets.top, 16),
          borderBottomColor: borderBottomColor
        }
      ]}
    >
      {/* 1. Left Action Container (renders back arrow if enabled) */}
      <View style={styles.leftContainer}>
        {shouldShowBack && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-left" size={28} color={textColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Middle Title Label Container */}
      <View style={styles.titleContainer}>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* 3. Right Action Slot Container (renders rightAction component or legacy rightIcon button) */}
      <View style={styles.rightContainer}>
        {rightAction ? (
          rightAction
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightPress}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: rightIconBg || (isDark ? '#818CF8' : '#6366F1'),
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: rightIconBorder ? 1 : 0,
              borderColor: rightIconBorder || 'transparent',
            }}
          >
            <MaterialIcons name={rightIcon} size={22} color={rightIconColor || "#FFFFFF"} />
          </TouchableOpacity>
        ) : children ? (
          children
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
    </View>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    backgroundColor: 'transparent',
  },
  leftContainer: {
    width: 48,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  rightContainer: {
    width: 48,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});

export default ScreenHeader;
