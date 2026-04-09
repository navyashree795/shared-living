import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function EmptyState({ 
  icon, 
  title, 
  description, 
  iconBg = "bg-secondary",
  iconColor = "#4F46E5",
  iconSize = 40,
  borderStyle = "border-dashed"
}) {
  return (
    <View className={`items-center mt-6 bg-white p-8 rounded-3xl border border-border ${borderStyle}`}>
      <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 border border-primary/10 ${iconBg}`}>
        <MaterialIcons name={icon} size={iconSize} color={iconColor} />
      </View>
      <Text className="text-textMain text-lg font-bold mb-1 text-center">{title}</Text>
      <Text className="text-textMuted text-sm text-center px-4 leading-5">{description}</Text>
    </View>
  );
}
