import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ActivityIndicator, Alert, 
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const normalizePhone = (phone: string) => {
    return phone.replace(/[^\d+]/g, '');
  };

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && (!phoneNumber || !username))) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const lowerUsername = username.trim().toLowerCase();
        
        const usernameSnap = await getDoc(doc(db, "usernames", lowerUsername));
        if (usernameSnap.exists()) {
          Alert.alert("Error", "Username is already taken.");
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          username: lowerUsername,
          phoneNumber: normalizePhone(phoneNumber),
          householdId: null,
          createdAt: new Date().toISOString()
        });
        
        await setDoc(doc(db, "usernames", lowerUsername), { uid: userCredential.user.uid });
        Alert.alert("Success", "Account created successfully!");
        
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "An account with this email already exists.";
      }
      Alert.alert("Authentication Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert("Reset Password", "Please enter your email address first.");
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => Alert.alert("Success", "Password reset email sent!"))
      .catch(error => Alert.alert("Error", error.message));
  };

  const innerContent = (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingTop: 60, paddingBottom: 40 }} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View className="px-6 items-center">
          {/* App Branding */}
          <View className="items-center mb-10 w-full mt-4">
            <View className="w-16 h-1 bg-black rounded-full mb-8 opacity-20" />
            <Text className="text-4xl font-black text-black mb-3 tracking-tighter">Shared Living</Text>
            <Text className="text-sm text-gray-500 text-center leading-5 max-w-[280px]">
              Manage your household tasks, expenses, and groceries effortlessly.
            </Text>
          </View>

          <View className="w-full bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <Text className="text-2xl font-black text-black mb-6 text-center tracking-tight">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>

            <View className="mb-4">
              <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Email</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100"
                placeholder="name@example.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            {isSignUp && (
              <>
                <View className="mb-4">
                  <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Phone</Text>
                  <TextInput
                    className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100"
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor="#9CA3AF"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />
                </View>
                <View className="mb-4">
                  <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Username</Text>
                  <TextInput
                    className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100"
                    placeholder="unique_username"
                    placeholderTextColor="#9CA3AF"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
              </>
            )}

            <View className="mb-2">
              <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest pl-1">Password</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-5 py-4 text-black text-base border border-gray-100"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleAuth}
              />
            </View>

            {!isSignUp && (
              <TouchableOpacity className="self-end mb-6 mt-1" onPress={handleForgotPassword}>
                <Text className="text-gray-500 text-sm font-bold">Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="bg-black py-4 rounded-2xl items-center justify-center shadow-lg mt-2 mb-6"
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-white text-base font-bold tracking-wide">
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3 items-center mb-2"
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text className="text-gray-500 text-sm font-medium">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text className="text-black font-bold">{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>

            <Text className="text-[11px] text-gray-400 text-center px-4 leading-relaxed">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]">
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {innerContent}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>
          {innerContent}
        </View>
      )}
    </SafeAreaView>
  );
}
