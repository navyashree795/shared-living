import React from 'react';
import { 
  View, Text, Modal, TouchableOpacity, ScrollView, Platform, 
  KeyboardAvoidingView, Dimensions, TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
          <View className="flex-1 bg-black/50 justify-end">
            <TouchableOpacity 
              className="flex-1" 
              activeOpacity={1} 
              onPress={onClose} 
            />
            <View 
              className="bg-white rounded-t-[40px] shadow-2xl overflow-hidden"
              style={{ maxHeight: MAX_MODAL_HEIGHT }}
            >
              <SafeAreaView edges={['bottom']}>
                <View className="p-6 pb-2">
                  <View className="w-12 h-1.5 bg-border rounded-full self-center mb-5" />
                  <View className="flex-row justify-between items-center mb-5">
                    <Text className="text-textMain text-2xl font-black tracking-tight">{title}</Text>
                    <TouchableOpacity 
                      onPress={onClose}
                      className="w-10 h-10 rounded-full bg-secondary items-center justify-center"
                    >
                      <MaterialIcons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView 
                    scrollEnabled={scrollEnabled}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                  >
                    {children}
                  </ScrollView>
                </View>
              </SafeAreaView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SlideModal;
