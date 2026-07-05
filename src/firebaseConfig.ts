/*
 * FILE: src/firebaseConfig.ts
 * PURPOSE: Initializes the Firebase client SDK and exports the auth, firestore, storage, and functions references.
 * WHERE USED: Used throughout the application (such as in contexts and screens) to read/write database documents,
 *             handle authentication sessions, upload files, and trigger backend Cloud Functions.
 */

// Import the primary Firebase app initializer function from the core SDK
import { initializeApp } from 'firebase/app';
// Import authentication features to handle login, logout, and user sessions, and persistence to store login state on-device
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
// Import Firestore features to store and retrieve real-time documents (chores, expenses, etc.) with offline caching support
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
// Import Storage features to save and load user profile photos and receipt images
import { getStorage } from 'firebase/storage';
// Import Functions features to interact with Firebase backend HTTPS callable functions (e.g., inviting users)
import { getFunctions } from 'firebase/functions';
// Import AsyncStorage for saving user auth tokens locally so users don't have to re-login every time they open the app
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration extracted from environment variables for security (values are defined in the .env file)
const firebaseConfig = {
  // Web API key used to identify the Firebase project against Google's servers
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  // Domain name for routing authentications, e.g., <project-id>.firebaseapp.com
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // Unique identifier for the Google Cloud / Firebase project
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  // URL pointing to the Firebase Storage bucket where media uploads are stored
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  // Unique sender ID for routing cloud notifications and push messages
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // Unique identifier for this specific React Native/Expo app instance inside the project
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required config is present to prevent runtime crashes
const missingKeys = Object.entries(firebaseConfig)
  // Filter the config object to find any key-value pairs where the value is missing/undefined
  .filter(([_, value]) => !value)
  // Map those entries back to just an array of the names of the missing keys
  .map(([key]) => key);

// If any keys are missing, log error messages to help developer fix their environment setup
if (missingKeys.length > 0) {
  console.error(`Firebase configuration error: Missing environment variables: ${missingKeys.join(', ')}`);
  console.error("Make sure your .env file is correctly configured and the dev server is restarted.");
}

// Initialize Firebase App globally using our configuration
let app;
try {
  // Pass the config credentials to initialize the main Firebase application instance
  app = initializeApp(firebaseConfig);
} catch (error) {
  // If configuration values are invalid or SDK fails to load, log the error and crash
  console.error("Failed to initialize Firebase App:", error);
  throw error;
}

// Initialize Firebase Auth with React Native persistence to keep users logged in across app restarts
const auth = initializeAuth(app, {
  // Specify that AsyncStorage should be used to securely persist user authentication state on the device
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore with persistent offline local cache support
const db = initializeFirestore(app, {
  // Configures local cache so the app can query and write data even when the phone has no internet connection
  localCache: persistentLocalCache({})
});

// Initialize the Firebase Cloud Storage module instance
const storage = getStorage(app);

// Initialize Firebase Cloud Functions (used to call server-side functions like invitations and notifications)
const functions = getFunctions(app);

// Export the initialized Firebase references for use across all files in the application
export { app, auth, db, storage, functions };
