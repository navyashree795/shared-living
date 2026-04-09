import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SlideModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const SlideModal: React.FC<SlideModalProps> = ({ visible, onClose, title, children }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity 
          className="flex-1" 
          activeOpacity={1} 
          onPress={onClose} 
        />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="bg-white rounded-t-[40px] shadow-2xl"
        >
          <SafeAreaView edges={['bottom']}>
            <View className="p-6 pb-2">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-textMain text-2xl font-black tracking-tight">{title}</Text>
                <TouchableOpacity 
                  onPress={onClose}
                  className="w-10 h-10 rounded-full bg-secondary items-center justify-center"
                >
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {children}
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default SlideModal;
