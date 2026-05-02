import React from 'react';
import { 
  View, Text, Modal, TouchableOpacity, ScrollView, Platform, 
  KeyboardAvoidingView, Dimensions, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/50 justify-center px-6">
            <TouchableOpacity 
              className="absolute inset-0" 
              activeOpacity={1} 
              onPress={onClose} 
            />
            <View 
              className="bg-white rounded-[32px] shadow-2xl overflow-hidden relative"
              style={{ maxHeight: MAX_MODAL_HEIGHT }}
            >
              <View className="p-6">
                <View className="flex-row justify-between items-center mb-5 mt-2">
                  <Text className="text-textMain text-2xl font-black tracking-tight">{title}</Text>
                  <TouchableOpacity 
                    onPress={onClose}
                    className="w-10 h-10 rounded-full bg-secondary/50 items-center justify-center"
                  >
                    <MaterialIcons name="close" size={20} color="#6B7280" />
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
