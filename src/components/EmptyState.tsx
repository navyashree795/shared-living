import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  const { isDark } = useTheme();
  const text = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#818CF8' : '#64748B';
  const iconBg = isDark ? '#0F1320' : '#F1F5F9';
  const iconColor = isDark ? '#4F46E5' : '#94A3B8';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
      <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <MaterialIcons name={icon} size={36} color={iconColor} />
      </View>
      <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>{description}</Text>
    </View>
  );
};

export default EmptyState;
