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
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';
  const bord = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.85)';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {!hideBack && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: surfaceBg, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: bord }}
          >
            <MaterialIcons name="arrow-back" size={22} color={text} />
          </TouchableOpacity>
        )}
        <Text style={{ color: text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {children}
        {rightIcon && (
          <TouchableOpacity 
            onPress={onRightPress}
            style={{
              width: 40, height: 40, borderRadius: 14,
              backgroundColor: rightIconBg || (isDark ? '#1E1B4B' : '#EEF2FF'),
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: rightIconBorder || bord,
            }}
          >
            <MaterialIcons name={rightIcon} size={22} color={rightIconColor || (isDark ? '#818CF8' : '#6366F1')} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ScreenHeader;
