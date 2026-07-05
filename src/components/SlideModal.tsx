/*
 * FILE: src/components/SlideModal.tsx
 * PURPOSE: Custom bottom slide-up modal sheet container adjusting to safe area notches
 *          and sliding keyboard behaviors.
 * WHERE USED: All overlay drawers modals (e.g. quick actions, detail edit screens) to wrap forms.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React from 'react';
// Import layout components, style sheets, touch buttons, keyboard avoids, and modal bases
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TouchableWithoutFeedback, 
  KeyboardAvoidingView, 
  ScrollView 
} from 'react-native';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import safe area notch padding hook
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Import theme hook
import { useTheme } from '../context/ThemeContext';
// Import keyboard utility helper
import { getKeyboardAvoidingProps } from '../utils/keyboardUtils';

interface SlideModalProps {
  // Modal visibility trigger flag
  visible: boolean;
  // Callback invoked on close
  onClose: () => void;
  // Header title label text
  title: string;
  // Nested form child components
  children: React.ReactNode;
  // Optional flag to control scrolling capability
  scrollEnabled?: boolean;
}

// Render SlideModal memoized to optimize re-renders
export const SlideModal = React.memo(({ 
  visible, 
  onClose, 
  title, 
  children,
  scrollEnabled = true
}: SlideModalProps) => {
  // Retrieve notch height insets
  const insets = useSafeAreaInsets();
  // Access global dark theme context
  const { isDark } = useTheme();

  // Color tokens
  const bgTheme = isDark ? '#0b0d19' : '#FFFFFF';
  const textMain = isDark ? '#F1F5F9' : '#1A1D3B';
  const overlayBg = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(15, 23, 42, 0.4)';
  const dragBarBg = isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0';
  const borderBottomColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#EEF2FF';

  // Compute keyboard offset properties
  const keyboardProps = getKeyboardAvoidingProps('modal', insets.top);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* 1. Backdrop Overlay touch container */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
          {/* 2. Keyboard avoiding shift container */}
          <KeyboardAvoidingView {...keyboardProps} style={styles.keyboardView}>
            {/* Prevent touch bubbles from closing when inside the sheet content */}
            <TouchableWithoutFeedback>
              <View 
                style={[
                  styles.modalContent, 
                  { 
                    backgroundColor: bgTheme,
                    // Offset bottom to avoid notch clipping
                    paddingBottom: Math.max(insets.bottom, 24),
                  }
                ]}
              >
                {/* 3. Drag indicator top bar */}
                <View style={styles.dragIndicatorWrapper}>
                  <View style={[styles.dragIndicator, { backgroundColor: dragBarBg }]} />
                </View>

                {/* 4. Drawer Header Title Section */}
                <View style={[styles.header, { borderBottomColor: borderBottomColor }]}>
                  <Text style={[styles.headerTitle, { color: textMain }]}>{title}</Text>
                  {/* Close button */}
                  <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={20} color={textMain} />
                  </TouchableOpacity>
                </View>

                {/* 5. Scrollable child forms wrapper */}
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  scrollEnabled={scrollEnabled}
                >
                  {children}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// Explicitly assign display name for React DevTools mapping
SlideModal.displayName = 'SlideModal';

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  modalContent: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    maxHeight: '85%',
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragIndicator: {
    width: 36,
    height: 4.5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 6,
    borderRadius: 14,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

export default SlideModal;
