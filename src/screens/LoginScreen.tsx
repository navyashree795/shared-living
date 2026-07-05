/*
 * FILE: src/screens/LoginScreen.tsx
 * PURPOSE: Renders the login, registration, and password reset form screen. It coordinates
 *          user sign-ins and accounts creations with Firebase Authentication and Firestore databases.
 * WHERE USED: Loaded as the default fallback route inside App.tsx when UserContext has no authenticated session.
 */

// Import React and useState hook to manage local form parameters
import React, { useState } from 'react';
// Import essential layout components, text elements, touch clickables, spinners, keyboards dismiss, and images
import { 
  View, Text, TouchableOpacity, ActivityIndicator, Alert, 
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  TouchableWithoutFeedback, Keyboard, Image 
} from 'react-native';
// Import safe area providers to ensure elements do not get cut off by screen notches
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Import vector icons library for input fields (eye icon for passwords)
import { MaterialIcons } from '@expo/vector-icons';
// Import keyboard offset calculators to align form inputs properly when keyboards pop up
import { getKeyboardAvoidingProps } from '../utils/keyboardUtils';
// Import Firebase Authentication operations to sign in, sign up, and dispatch password reset links
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail
} from 'firebase/auth';
// Import Firestore operations to retrieve and write user credentials documents
import { doc, setDoc, getDoc } from 'firebase/firestore';
// Import global database references
import { auth, db } from '../firebaseConfig';
// Import screen routing types from react-navigation
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// Import project TS parameter list mapping
import { RootStackParamList } from '../types';

// Define TS parameter props for the Login route
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

/**
 * LoginScreen component containing credential verification, sign up forms, and reset controllers.
 */
export default function LoginScreen({ navigation }: Props) {
  // Grab safe area top padding insets
  const insets = useSafeAreaInsets();
  // Get keyboard adjustment behavior specific to iOS/Android for the login page
  const { behavior, keyboardVerticalOffset } = getKeyboardAvoidingProps('login', insets.top);

  // Loading spinner trigger state
  const [loading, setLoading] = useState(false);
  // Email text state
  const [email, setEmail] = useState('');
  // Password text state
  const [password, setPassword] = useState('');
  // Contact phone number state (Only shown during registration mode)
  const [phoneNumber, setPhoneNumber] = useState('');
  // Custom display name/username state (Only shown during registration mode)
  const [username, setUsername] = useState('');
  // Flag indicating if screen is in Sign-up mode (true) or Sign-in mode (false)
  const [isSignUp, setIsSignUp] = useState(false);

  // Color theme definitions specifically designed for auth layouts to create a premium dark feel
  const bg      = '#0F172A'; // Dark slate background color
  const surface = '#1E293B'; // Lighter Slate surface container color
  const text    = '#F1F5F9'; // White-gray readable main text
  const muted   = '#94A3B8'; // Muted gray label color
  const bord    = '#334155'; // Slate border divider color
  const inputBg = '#0F172A'; // Deep dark input background color
  const accent  = '#6366F1'; // Indigo accent color for buttons and links

  // Toggle state to hide/reveal password text characters
  const [showPassword, setShowPassword] = useState(false);

  // Helper regular expression to remove spaces and special characters from phone strings
  const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  // Master handler function that executes either authentication login or registration
  const handleAuth = async () => {
    // 1. Core input parameter validation checks
    if (!email || !password || (isSignUp && (!phoneNumber || !username))) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Sign-up process:
        // A. Normalize and validate username string
        const cleaned = username.trim().replace(/^@+/, ''); // Strip leading @ symbol if user entered one
        const lowerUsername = cleaned.toLowerCase();
        if (!lowerUsername) {
          Alert.alert("Error", "Please enter a valid username");
          setLoading(false);
          return;
        }
        
        // B. Verify username uniqueness by checking the usernames lookup collection in Firestore
        const usernameSnap = await getDoc(doc(db, "usernames", lowerUsername));
        if (usernameSnap.exists()) {
          Alert.alert("Error", "Username is already taken.");
          setLoading(false);
          return;
        }

        // C. Create auth account credentials using Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // D. Create user details profile document in the '/users' collection
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          username: lowerUsername,
          phoneNumber: normalizePhone(phoneNumber),
          householdId: null, // Initialized as null so user is prompted to setup or join a household
          createdAt: new Date().toISOString()
        });
        
        // E. Save username lock document to prevent duplicate registries by other users
        await setDoc(doc(db, "usernames", lowerUsername), { uid: userCredential.user.uid });
        Alert.alert("Success", "Account created successfully!");
        
      } else {
        // Sign-in process:
        // Directly call Firebase Auth credential validator function
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      // Catch authentication exceptions and parse into helpful user messages
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

  // Helper dispatcher to send password reset links to email address
  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert("Reset Password", "Please enter your email address first.");
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => Alert.alert("Success", "Password reset email sent!"))
      .catch(error => Alert.alert("Error", error.message));
  };

  // Input fields component renderer helper to maintain design consistency
  const renderInput = (label: string, value: string, onChangeText: (t: string) => void, opts: any = {}) => {
    const isPassword = label === 'Password';
    return (
      <View style={{ marginBottom: 16 }}>
        {/* Uppercased label header */}
        <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2, paddingLeft: 4 }}>{label}</Text>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <TextInput
            style={{ 
              backgroundColor: inputBg, 
              borderRadius: 16, 
              paddingHorizontal: 20, 
              paddingVertical: 16, 
              paddingRight: isPassword ? 50 : 20, // Add spacing if password eye icon is present
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
            // Toggle text concealment based on showPassword state
            secureTextEntry={isPassword ? !showPassword : opts.secureTextEntry}
          />
          {/* If password field, overlay visibility toggle click button */}
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

  // Compile scrollable content wrapper containing logos and input forms
  const innerContent = (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }} 
      keyboardShouldPersistTaps="handled" // Allows user to tap actions directly without double tapping to dismiss keyboard first
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Keyboard dismissal hook wrapper */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'space-between' }}>
          <View style={{ flexGrow: 1, justifyContent: 'center' }}>
            {/* App Branding logo section */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={{ width: 180, height: 135, marginBottom: 12 }} 
                resizeMode="contain" 
              />
              <Text style={{ fontSize: 14, color: muted, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>
                Manage your household tasks, expenses, and groceries effortlessly.
              </Text>
            </View>

            {/* Input Form Card Container */}
            <View style={{ backgroundColor: surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: bord }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: text, marginBottom: 24, textAlign: 'center', letterSpacing: -0.5 }}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>

              {/* Email Form Field */}
              {renderInput('Email', email, setEmail, { placeholder: 'name@example.com', autoCapitalize: 'none', keyboardType: 'email-address', returnKeyType: 'next' })}

              {/* Show Phone & Username registration fields only if isSignUp is true */}
              {isSignUp && (
                <>
                  {renderInput('Phone', phoneNumber, setPhoneNumber, { placeholder: '+1 (555) 000-0000', keyboardType: 'phone-pad', returnKeyType: 'next' })}
                  {renderInput('Username', username, setUsername, { placeholder: 'unique_username', autoCapitalize: 'none', returnKeyType: 'next' })}
                </>
              )}

              {/* Password Form Field */}
              {renderInput('Password', password, setPassword, { placeholder: '••••••••', returnKeyType: 'done', onSubmitEditing: handleAuth })}

              {/* Forgot password link, shown only on sign-in mode */}
              {!isSignUp && (
                <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 }} onPress={handleForgotPassword}>
                  <Text style={{ color: accent, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Auth trigger button */}
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

              {/* Mode switch link (Switch between Sign Up / Sign In layouts) */}
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={{ color: muted, fontSize: 14, fontWeight: '500' }}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={{ color: accent, fontWeight: '800' }}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Legal footer */}
          <Text style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 24, lineHeight: 18, paddingHorizontal: 16 }}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* KeyboardAvoidingView adjusts positioning dynamically to keep active text inputs visible on screen */}
      <KeyboardAvoidingView behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset} style={{ flex: 1 }}>
        {innerContent}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
