import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ScreenHeaderProps {
  navigation: any;
  title: string;
  hideBack?: boolean;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIconColor?: string;
  rightIconBg?: string;
  rightIconBorder?: string;
  onRightPress?: () => void;
  children?: React.ReactNode;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ 
  navigation, 
  title, 
  hideBack = false,
  rightIcon, 
  rightIconColor,
  rightIconBg,
  rightIconBorder,
  onRightPress, 
  children 
}) => {
  const { isDark } = useTheme();
  const text = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#818CF8' : '#64748B';
  const bord = isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.08)';
  const surfaceBg = isDark ? 'rgba(129, 140, 248, 0.1)' : 'rgba(255, 255, 255, 0.85)';

  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 24, 
      paddingTop: 20,
      paddingBottom: 24,
      justifyContent: 'space-between' 
    }}>
      {/* Back Button */}
      <View style={{ width: 44 }}>
        {!hideBack && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 14, 
              backgroundColor: isDark ? '#111425' : '#F1F5F9', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderWidth: 1, 
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
            }}
          >
            <MaterialIcons name="chevron-left" size={24} color={text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Centered Title */}
      <Text style={{ 
        flex: 1,
        textAlign: 'center',
        color: text, 
        fontSize: 19, 
        fontWeight: '800', 
        letterSpacing: -0.2 
      }}>{title}</Text>

      {/* Right Action */}
      <View style={{ width: 44, alignItems: 'flex-end' }}>
        {rightIcon ? (
          <TouchableOpacity 
            onPress={onRightPress}
            style={{
              width: 44, 
              height: 44, 
              borderRadius: 14,
              backgroundColor: isDark ? '#818CF8' : '#6366F1',
              alignItems: 'center', 
              justifyContent: 'center',
              shadowColor: isDark ? '#818CF8' : '#6366F1',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4
            }}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : children}
      </View>
    </View>
  );
};

export default ScreenHeader;
