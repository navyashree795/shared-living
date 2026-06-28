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
  const surface = isDark ? '#0F1320' : '#FFFFFF';
  const text = isDark ? '#E2E8F0' : '#0F172A';
  const muted = isDark ? '#818CF8' : '#64748B';
  const closeBg = isDark ? '#151C30' : '#F1F5F9';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 24 : 16
      }}>
        {/* Backdrop closes modal and dismisses keyboard */}
        <TouchableOpacity 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
          activeOpacity={1} 
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }} 
        />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ width: '92%', maxWidth: 350 }}
        >
          <View style={{ backgroundColor: surface, borderRadius: 24, overflow: 'hidden', maxHeight: MAX_MODAL_HEIGHT, elevation: 24 }}>
            {/* Handle pill */}
            <View style={{ alignItems: 'center', paddingTop: 10 }}>
              <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: isDark ? '#334155' : '#CBD5E1' }} />
            </View>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }}>{title}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: closeBg, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialIcons name="close" size={16} color={muted} />
                </TouchableOpacity>
              </View>
              {scrollEnabled ? (
                <ScrollView 
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 10 }}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  scrollEventThrottle={16}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={{ paddingBottom: 10 }}>
                  {children}
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default SlideModal;
