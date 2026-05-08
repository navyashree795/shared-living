import React from 'react';
import { 
  View, Text, Modal, TouchableOpacity, ScrollView, Platform, 
  KeyboardAvoidingView, Dimensions, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface SlideModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  scrollEnabled?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;

const SlideModal: React.FC<SlideModalProps> = ({ visible, onClose, title, children, scrollEnabled = true }) => {
  const { isDark } = useTheme();
  const surface = isDark ? '#1E293B' : '#FFFFFF';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const muted = isDark ? '#94A3B8' : '#64748B';
  const closeBg = isDark ? '#334155' : '#F1F5F9';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={onClose} />
            <View style={{ backgroundColor: surface, borderRadius: 32, overflow: 'hidden', maxHeight: MAX_MODAL_HEIGHT, elevation: 24 }}>
              {/* Handle pill */}
              <View style={{ alignItems: 'center', paddingTop: 12 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#475569' : '#CBD5E1' }} />
              </View>
              <View style={{ padding: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{title}</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: closeBg, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <MaterialIcons name="close" size={18} color={muted} />
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  scrollEnabled={scrollEnabled}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 10 }}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  {children}
                </ScrollView>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SlideModal;
