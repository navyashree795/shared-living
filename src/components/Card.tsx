import React from 'react';
import { View, TouchableOpacity, ViewProps, TouchableOpacityProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface CardProps extends ViewProps {
  onPress?: () => void;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, onPress, style, ...props }) => {
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.7, onPress } as TouchableOpacityProps : {};
  const { isDark } = useTheme();

  return (
    <Container 
      {...containerProps}
      className={`rounded-[28px] p-5 mb-4 border shadow-sm ${props.className || ''}`}
      style={[
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.85)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.08)',
        },
        style
      ]}
    >
      {children}
    </Container>
  );
};
