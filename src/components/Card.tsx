import React from 'react';
import { View, TouchableOpacity, ViewProps, TouchableOpacityProps } from 'react-native';

interface CardProps extends ViewProps {
  onPress?: () => void;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style, ...props }) => {
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.7, onPress } as TouchableOpacityProps : {};

  return (
    <Container 
      {...containerProps}
      className={`bg-white rounded-[28px] p-5 mb-4 border border-border shadow-sm ${props.className || ''}`}
      style={style}
    >
      {children}
    </Container>
  );
};
