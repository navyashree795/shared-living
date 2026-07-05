/*
 * FILE: src/components/Card.tsx
 * PURPOSE: Custom card container wrapping children with consistent margins, shadows, and click listeners.
 * WHERE USED: Dashboard screen sections widgets wrappers.
 */

// Import React components references
import React from 'react';
// Import layout components, touch buttons, and style wrappers
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

interface CardProps {
  // Nested inner children components
  children: React.ReactNode;
  // Optional container style overrides
  style?: ViewStyle;
  // Optional click handler function
  onPress?: () => void;
}

// Render Card wrapper
export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  // If card is clickable, render inside touch button; otherwise, render inside plain view
  if (onPress) {
    return (
      <TouchableOpacity 
        style={[styles.card, style]} 
        onPress={onPress} 
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.08)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 16,
  },
});
