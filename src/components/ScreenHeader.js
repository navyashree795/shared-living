import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ScreenHeader({ 
  navigation, 
  title, 
  rightIcon, 
  onRightPress, 
  rightIconColor = "#4F46E5",
  rightIconBg = "bg-primary/10",
  rightIconBorder = "border-primary/20",
  hideBack = false 
}) {
  return (
    <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
      {!hideBack && (
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          className="p-2 -ml-2 bg-white rounded-full border border-border shadow-sm"
        >
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
      )}
      <Text className={`flex-1 text-2xl font-extrabold text-textMain ${hideBack ? '' : 'ml-4'}`}>{title}</Text>
      
      {rightIcon && (
        <TouchableOpacity 
          className={`rounded-full w-10 h-10 items-center justify-center border ${rightIconBg} ${rightIconBorder}`}
          onPress={onRightPress}
        >
          <MaterialIcons name={rightIcon} size={24} color={rightIconColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}
