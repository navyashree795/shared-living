import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  return (
    <View className="items-center justify-center py-20 px-10">
      <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center mb-6">
        <MaterialIcons name={icon} size={40} color="#9CA3AF" />
      </View>
      <Text className="text-textMain text-xl font-bold mb-2 text-center">{title}</Text>
      <Text className="text-textMuted text-sm text-center leading-6">{description}</Text>
    </View>
  );
};

export default EmptyState;
