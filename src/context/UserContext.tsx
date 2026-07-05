/*
 * FILE: src/context/UserContext.tsx
 * PURPOSE: Manages the authentication state of the current user. It subscribes to real-time changes
 *          in the Firebase Auth session and synchronizes it with the user's custom Firestore profile document.
 * WHERE USED: Wrapped at the root level of the app in App.tsx. Any component can invoke `useUser()`
 *             to read the current user object, custom profile properties, or loading state.
 */

// Import core React hooks for state, side effects, and creating context, plus the ReactNode type for child elements
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// Import initialized Firebase Auth and Firestore database references from the central configuration
import { auth, db } from '../firebaseConfig';
// Import the Firebase Auth listener function and the User interface type definition
import { onAuthStateChanged, User } from 'firebase/auth';
// Import Firestore functions to get document references and subscribe to real-time changes
import { doc, onSnapshot } from 'firebase/firestore';
// Import the UserProfile interface definition to enforce structure on user properties
import { UserProfile } from '../types';
// Import helper utility to attach user credentials to sentry error logs
import { setSentryUser } from '../utils/errorLogger';

// Define the shape of the data that this Context will share with the rest of the application
interface UserContextType {
  // The Firebase Auth user object representing active session tokens (null if logged out)
  user: User | null;
  // The custom Firestore profile document containing application-specific fields (null if logged out)
  profile: UserProfile | null;
  // True if the app is still fetching the authentication session or profile from the server
  loading: boolean;
}

// Create the context container with an initial value of undefined
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * UserProvider is the component wrapper that feeds user login state to all children.
 * It sets up real-time session listeners upon initialization.
 */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  // React state hook to hold the Firebase Auth credential object
  const [user, setUser] = useState<User | null>(null);
  // React state hook to hold the Firestore user profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // React state hook to track whether initial auth check is finished
  const [loading, setLoading] = useState(true);

  // Set up side effects on component mount to sync auth state
  useEffect(() => {
    // 1. Subscribe to Firebase Authentication session changes (logins, logouts, token renewals)
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Update the local state with the user object returned by Firebase
      setUser(currentUser);
      
      // If a user session is active (meaning they logged in)
      if (currentUser) {
        // Feed user credentials to Sentry to associate runtime exceptions with this account
        setSentryUser(currentUser.uid, currentUser.email);

        // 2. Subscribe to real-time updates of the user's Firestore profile document at /users/{uid}
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          (docSnap) => {
            // Check if the document exists in Firestore
            if (docSnap.exists()) {
              // Cast and save the document data to the local profile state
              setProfile(docSnap.data() as UserProfile);
            }
            // Once profile data is loaded, set loading to false to unblock navigation
            setLoading(false);
          },
          (error) => {
            // Log any query permissions or connection errors to console
            console.error("Error fetching user profile:", error);
            // Even if it fails, set loading to false to prevent the app from hanging on a white screen
            setLoading(false);
          }
        );
        // Return unsubscribe cleanup function for the profile listener if auth changes or component unmounts
        return () => unsubscribeProfile();
      } else {
        // If no user session is active (logged out)
        // Clear user metadata inside Sentry error telemetry
        setSentryUser(null, null);
        // Clear local profile variables
        setProfile(null);
        // End the loading state
        setLoading(false);
      }
    });

    // Return the unsubscribe cleanup function for the auth listener when provider unmounts
    return () => unsubscribeAuth();
  }, []);

  return (
    // Broadcast the auth state, profile data, and loading flags to all children inside this provider
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Custom hook useUser allows any child component to quickly access the current user session context.
 * Throws a helpful error if called by components that lie outside the UserProvider hierarchy.
 */
export const useUser = (): UserContextType => {
  // Grab the context state
  const context = useContext(UserContext);
  // If context is undefined, it means this hook was called outside of a <UserProvider> wrapper
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  // Return the active session parameters
  return context;
};
