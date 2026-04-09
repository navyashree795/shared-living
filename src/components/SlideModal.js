import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function SlideModal({ 
  visible, 
  onClose, 
  title, 
  children 
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-[32px] p-6 max-h-[90%] shadow-2xl pb-10">
            
            <View className="flex-row justify-between items-center mb-6 pt-2">
              <Text className="text-textMain text-2xl font-extrabold">{title}</Text>
              <TouchableOpacity 
                onPress={onClose} 
                className="bg-white p-2 rounded-full border border-border shadow-sm"
              >
                <MaterialIcons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
