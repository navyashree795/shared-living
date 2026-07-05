/*
 * FILE: src/components/Avatar.tsx
 * PURPOSE: Reusable image or text-initials profile avatar rendering circular bubbles.
 * WHERE USED: Screen headers, member list items, chats messages bubbles, and dashboard profiles.
 */

// Import React module reference
import React from 'react';
// Import layout components, texts, and images
import { View, Text, ViewProps, Image } from 'react-native';

// Prop declarations mapping component params
interface AvatarProps extends ViewProps {
  // roomate display name
  name: string;
  // Size bounds diameter of circular avatar bubble
  size?: number;
  // Foreground text/initial color
  color?: string;
  // Background circle bubble color
  bgColor?: string;
  // Optional URL pointing to profile image files
  photoUrl?: string;
}

// Render Avatar component
export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  size = 32, 
  color = '#4F46E5', 
  bgColor = '#E0E7FF',
  photoUrl,
  ...props 
}) => {
  // Extract the first letter from display name to use as default placeholder text
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  // Compute font size based on circular diameter dimensions
  const fontSize = size * 0.4;

  return (
    // Outer circular container
    <View 
      {...props}
      style={[{ 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        backgroundColor: bgColor, 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden'
      }, props.style]}
    >
      {/* If profile picture URL is supplied, render the image; otherwise, fall back to initial letter */}
      {photoUrl ? (
        <Image 
          source={{ uri: photoUrl }} 
          style={{ width: size, height: size }} 
          resizeMode="cover"
        />
      ) : (
        <Text style={{ fontSize, fontWeight: 'bold', color }}>{initial}</Text>
      )}
    </View>
  );
};
