import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ActivityIndicator, Alert, 
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
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

  // Always dark on auth screens for premium feel
  const bg      = '#0F172A';
  const surface = '#1E293B';
  const text    = '#F1F5F9';
  const muted   = '#94A3B8';
  const bord    = '#334155';
  const inputBg = '#0F172A';
  const accent  = '#6366F1';

  const [showPassword, setShowPassword] = useState(false);

  const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');

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

  const renderInput = (label: string, value: string, onChangeText: (t: string) => void, opts: any = {}) => {
    const isPassword = label === 'Password';
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2, paddingLeft: 4 }}>{label}</Text>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <TextInput
            style={{ 
              backgroundColor: inputBg, 
              borderRadius: 16, 
              paddingHorizontal: 20, 
              paddingVertical: 16, 
              paddingRight: isPassword ? 50 : 20,
              color: text, 
              fontSize: 15, 
              fontWeight: '600', 
              borderWidth: 1, 
              borderColor: bord 
            }}
            placeholderTextColor="#475569"
            value={value}
            onChangeText={onChangeText}
            {...opts}
            secureTextEntry={isPassword ? !showPassword : opts.secureTextEntry}
          />
          {isPassword && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 16, padding: 4 }}
            >
              <MaterialIcons 
                name={showPassword ? 'visibility' : 'visibility-off'} 
                size={22} 
                color={muted} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const innerContent = (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ paddingHorizontal: 24 }}>
          {/* App Branding */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <MaterialIcons name="home" size={32} color="#fff" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: text, letterSpacing: -1, marginBottom: 8 }}>Shared Living</Text>
            <Text style={{ fontSize: 14, color: muted, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>
              Manage your household tasks, expenses, and groceries effortlessly.
            </Text>
          </View>

          {/* Form Card */}
          <View style={{ backgroundColor: surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: bord }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: text, marginBottom: 24, textAlign: 'center', letterSpacing: -0.5 }}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>

            {renderInput('Email', email, setEmail, { placeholder: 'name@example.com', autoCapitalize: 'none', keyboardType: 'email-address', returnKeyType: 'next' })}

            {isSignUp && (
              <>
                {renderInput('Phone', phoneNumber, setPhoneNumber, { placeholder: '+1 (555) 000-0000', keyboardType: 'phone-pad', returnKeyType: 'next' })}
                {renderInput('Username', username, setUsername, { placeholder: 'unique_username', autoCapitalize: 'none', returnKeyType: 'next' })}
              </>
            )}

            {renderInput('Password', password, setPassword, { placeholder: '••••••••', returnKeyType: 'done', onSubmitEditing: handleAuth })}

            {!isSignUp && (
              <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 }} onPress={handleForgotPassword}>
                <Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              style={{ backgroundColor: accent, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={{ color: muted, fontSize: 14, fontWeight: '500' }}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: accent, fontWeight: '800' }}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 24, lineHeight: 18, paddingHorizontal: 16 }}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {innerContent}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
