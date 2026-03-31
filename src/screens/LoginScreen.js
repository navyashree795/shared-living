import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const normalizePhone = (phone) => {
    return phone.replace(/[^\d+]/g, '');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        navigation.replace('HouseholdSelection');
      }
    });
    return unsubscribe;
  }, []);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && (!phoneNumber || !username))) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const lowerUsername = username.trim().toLowerCase();
        // Check username uniqueness
        const usernameSnap = await getDoc(doc(db, "usernames", lowerUsername));
        if (usernameSnap.exists()) {
          Alert.alert("Error", "Username is already taken. Please choose another one.");
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
        
        // Reserve username
        await setDoc(doc(db, "usernames", lowerUsername), { uid: userCredential.user.uid });
        
        Alert.alert("Success", "Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error("Auth Error:", error.code, error.message);
      let errorMessage = error.message;

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/Password sign-in is not enabled in your Firebase Console.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View className="px-6 py-10 items-center">

            {/* App Branding */}
            <View className="items-center mb-10">
              <Text className="text-4xl font-extrabold text-primary mb-2 tracking-tight">Shared Living</Text>
              <Text className="text-base text-textMuted text-center px-4 leading-6">
                Manage your household tasks, expenses, and groceries seamlessly.
              </Text>
            </View>

            <View className="w-full bg-white rounded-3xl p-6 shadow-sm border border-border">
              <Text className="text-2xl font-black text-textMain mb-6 text-center tracking-tight">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Email Address</Text>
                <TextInput
                  className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border"
                  placeholder="name@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {isSignUp && (
                <>
                  <View className="mb-4">
                    <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Phone Number</Text>
                    <TextInput
                      className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border"
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor="#9CA3AF"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View className="mb-4">
                    <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Username</Text>
                    <TextInput
                      className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border"
                      placeholder="unique_username"
                      placeholderTextColor="#9CA3AF"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              <View className="mb-2">
                <Text className="text-sm font-bold text-textMuted mb-2 ml-1">Password</Text>
                <TextInput
                  className="bg-background rounded-xl px-4 py-3.5 text-textMain text-base border border-border"
                  placeholder="Your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {!isSignUp && (
                <TouchableOpacity className="self-end mb-6" onPress={handleForgotPassword}>
                  <Text className="text-primary text-sm font-bold">Forgot password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                className="bg-primary py-4 rounded-xl items-center justify-center shadow-sm shadow-primary/50 mb-5 mt-4"
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text className="text-white text-lg font-bold">
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="py-2 items-center mb-4"
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text className="text-textMuted text-base font-medium">
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text className="text-primary font-bold">{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-textMuted text-center leading-5 px-4">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </Text>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
