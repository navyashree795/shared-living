import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration extracted from the user's Firebase console screenshot
const firebaseConfig = {
  apiKey: "AIzaSyCnp_SZ0uT16bOSqeGP_bxPhQ2TPQR4GlM",
  authDomain: "shared-living-app.firebaseapp.com",
  projectId: "shared-living-app",
  storageBucket: "shared-living-app.firebasestorage.app",
  messagingSenderId: "362366255638",
  appId: "1:362366255638:web:89e4a7c00f5aedbc60ab37"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with React Native persistence to keep users logged in
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { app, auth };
