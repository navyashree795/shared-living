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

  if (!isIOS) {
    return {
      behavior: screenName === 'modal' ? 'padding' : undefined,
      keyboardVerticalOffset: 0,
    };
  }

  if (screenName === 'modal') {
    return {
      behavior: 'padding',
      keyboardVerticalOffset: 0,
    };
  }

  if (screenName === 'chat') {
    // For Chat screen, we offset by the custom header height (approx. 66 + safeAreaTop)
    return {
      behavior: 'padding',
      keyboardVerticalOffset: safeAreaTop + 66,
    };
  }

  // Scrollable screens (login, profile, setup)
  // On iOS, we pad by the custom header offset.
  let offset = 0;
  if (screenName === 'profile') {
    offset = safeAreaTop + 64;
  } else if (screenName === 'setup') {
    offset = safeAreaTop + 50;
  } else {
    offset = safeAreaTop + 40; // login default offset
  }

  return {
    behavior: 'padding',
    keyboardVerticalOffset: offset,
  };
}
