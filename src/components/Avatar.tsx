import React from 'react';
import { View, Text, ViewProps } from 'react-native';

interface AvatarProps extends ViewProps {
  name: string;
  size?: number;
  color?: string;
  bgColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  size = 32, 
  color = '#4F46E5', 
  bgColor = '#E0E7FF',
  ...props 
}) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const fontSize = size * 0.4;

  return (
    <View 
      {...props}
      style={[{ 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        backgroundColor: bgColor, 
        alignItems: 'center', 
        justifyContent: 'center' 
      }, props.style]}
    >
      <Text style={{ fontSize, fontWeight: 'bold', color }}>{initial}</Text>
    </View>
  );
};
