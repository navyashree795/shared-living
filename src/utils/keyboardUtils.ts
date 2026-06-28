import { Platform } from 'react-native';

export interface KeyboardAvoidingProps {
  behavior: 'padding' | 'height' | 'position' | undefined;
  keyboardVerticalOffset: number;
}

/**
 * Returns the correct KeyboardAvoidingView props for consistent keyboard behavior.
 * 
 * @param screenName The name of the screen (e.g. 'login', 'profile', 'chat', 'setup', 'modal')
 * @param safeAreaTop The top safe area inset (insets.top)
 * @returns {KeyboardAvoidingProps}
 */
export function getKeyboardAvoidingProps(
  screenName: 'login' | 'profile' | 'chat' | 'setup' | 'modal',
  safeAreaTop: number = 0
): KeyboardAvoidingProps {
  const isIOS = Platform.OS === 'ios';

  if (screenName === 'modal') {
    return {
      behavior: isIOS ? 'padding' : 'height',
      keyboardVerticalOffset: 0,
    };
  }

  if (screenName === 'chat') {
    // For Chat screen, we offset by the custom header height (approx. 66 + safeAreaTop)
    return {
      behavior: isIOS ? 'padding' : 'height',
      keyboardVerticalOffset: isIOS ? safeAreaTop + 66 : 0,
    };
  }

  // Scrollable screens (login, profile, setup)
  // On Android, we rely on native adjustResize (behavior: undefined) to avoid double-shrinking.
  // On iOS, we pad by the custom header offset.
  let offset = 0;
  if (isIOS) {
    if (screenName === 'profile') {
      offset = safeAreaTop + 64;
    } else if (screenName === 'setup') {
      offset = safeAreaTop + 50;
    } else {
      offset = safeAreaTop + 40; // login default offset
    }
  }

  return {
    behavior: isIOS ? 'padding' : undefined,
    keyboardVerticalOffset: offset,
  };
}
