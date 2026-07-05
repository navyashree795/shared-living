/*
 * FILE: src/utils/keyboardUtils.ts
 * PURPOSE: Utility function to calculate KeyboardAvoidingView offsets and behaviors dynamically.
 * WHERE USED: Used in input forms (e.g. Login, Setup, Chat, Profile screens) to ensure the phone keyboard
 *             does not block or overlay text input fields.
 */

// Import Platform API to detect host OS types (iOS vs Android)
import { Platform } from 'react-native';

// Prop declarations mapping KeyboardAvoidingView properties
export interface KeyboardAvoidingProps {
  // Navigation behavior mode for KeyboardAvoidingView: 'padding', 'height', 'position' or undefined
  behavior: 'padding' | 'height' | 'position' | undefined;
  // Offset layout height (in pixels) to account for top safe area bars and custom headers
  keyboardVerticalOffset: number;
}

/**
 * Calculates correct KeyboardAvoidingView parameters for clean, responsive input layouts.
 */
export function getKeyboardAvoidingProps(
  screenName: 'login' | 'profile' | 'chat' | 'setup' | 'modal',
  safeAreaTop: number = 0
): KeyboardAvoidingProps {
  // Store Boolean indicating if the app is executing on iOS
  const isIOS = Platform.OS === 'ios';

  // ─── ANDROID KEYBOARD ALIGNMENT ──────────────────────────────────────────
  // If the host OS is Android, bypass manual offsets since native windowSoftInputMode handles shifts
  if (!isIOS) {
    return {
      // Use padding calculations for overlay modal sheets only
      behavior: screenName === 'modal' ? 'padding' : undefined,
      // No custom pixel height offsets needed
      keyboardVerticalOffset: 0,
    };
  }

  // ─── IOS KEYBOARD ALIGNMENT ──────────────────────────────────────────────
  // If rendering inside a modal sheet overlay
  if (screenName === 'modal') {
    return {
      // Shift overlay upward using view paddings
      behavior: 'padding',
      // No vertical header offsets inside modal context
      keyboardVerticalOffset: 0,
    };
  }

  // If rendering inside the real-time chat interface screen
  if (screenName === 'chat') {
    return {
      // Pad input bar upward
      behavior: 'padding',
      // Shift by safe area height plus custom navigation header (66px)
      keyboardVerticalOffset: safeAreaTop + 66,
    };
  }

  // Define fallback offset variable initialized to 0
  let offset = 0;
  // If screen target matches the user profile section
  if (screenName === 'profile') {
    // Pad by top notches plus profile page header height
    offset = safeAreaTop + 64;
  // If screen target matches household creation setup
  } else if (screenName === 'setup') {
    // Pad by setup header offset
    offset = safeAreaTop + 50;
  // For login screen layouts
  } else {
    // Pad by standard login header height
    offset = safeAreaTop + 40;
  }

  return {
    // Enable screen padding shifts
    behavior: 'padding',
    // Apply computed height offset
    keyboardVerticalOffset: offset,
  };
}
