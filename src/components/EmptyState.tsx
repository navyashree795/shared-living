/*
 * FILE: src/components/EmptyState.tsx
 * PURPOSE: Placeholder layout component displaying descriptions when feeds are empty.
 * WHERE USED: Feed widget areas (activities, bills, lists, timeline) when no entries exist.
 */

// Import React components references
import React from 'react';
// Import layout components, texts, and vector icons
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EmptyStateProps {
  // Title description header (optional fallback for title)
  message?: string;
  // Subtext detailed instructions
  description?: string;
  // Icon name lookup
  icon?: keyof typeof MaterialIcons.glyphMap;
  // Optional title property mapping
  title?: string;
}

// Render EmptyState component
export const EmptyState: React.FC<EmptyStateProps> = ({ 
  message, 
  title,
  description = "Tap the action button to get started.", 
  icon = "info-outline" 
}) => {
  const finalMessage = message || title || "No items found";
  return (
    <View style={styles.container}>
      {/* Icon header indicator */}
      <MaterialIcons name={icon} size={36} color="#94A3B8" style={styles.icon} />
      {/* Message title label */}
      <Text style={styles.message}>{finalMessage}</Text>
      {/* Description instruction label */}
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  icon: {
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default EmptyState;
