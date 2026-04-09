import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
  rightIconColor = "#FFF",
  rightIconBg = "bg-primary",
  rightIconBorder = "border-primary/20",
  onRightPress, 
  children 
}) => {
  return (
    <View className="flex-row items-center px-6 py-4 justify-between">
      <View className="flex-row items-center">
        {!hideBack && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-white items-center justify-center mr-4 border border-border shadow-sm"
          >
            <MaterialIcons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        )}
        <Text className="text-textMain text-2xl font-black tracking-tight">{title}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        {children}
        {rightIcon && (
          <TouchableOpacity 
            onPress={onRightPress}
            className={`w-10 h-10 rounded-full ${rightIconBg} items-center justify-center shadow-sm border ${rightIconBorder}`}
          >
            <MaterialIcons name={rightIcon} size={24} color={rightIconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ScreenHeader;
