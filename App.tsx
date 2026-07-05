/*
 * FILE: App.tsx
 * PURPOSE: Root React component of the application. It wraps the app with various React Context Providers
 *          (Toast, Theme, User, Household), configures standard navigation containers/stacks, handles 
 *          deep link processing (specifically user invitations), and sets up Sentry monitoring.
 * WHERE USED: This is the bootstrap/entry file run by Expo when launching the app.
 */

// Import React itself and the useEffect lifecycle hook to run side effects (like deep link checks)
import React, { useEffect } from 'react';
// Import the global CSS stylesheet (compiled using NativeWind/Tailwind) to apply styles across all components
import './global.css';
// Import Sentry crash reporting SDK to track uncaught exceptions and performance on mobile devices
import * as Sentry from '@sentry/react-native';
// Import custom utility function to initialize standard error logging systems
import { initGlobalErrorTracking } from './src/utils/errorLogger';
// Import StatusBar component to control the appearance of the top info bar (time, battery, signal) on phones
import { StatusBar } from 'expo-status-bar';

// Initialize global crash analytics and error tracking immediately on app startup
initGlobalErrorTracking();

// Import SafeAreaProvider to calculate and adjust layouts to avoid phone notches and screen cutouts
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import GestureHandlerRootView to enable smooth touch animations/swipes (like swipe-to-delete) across the app
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Import NavigationContainer to manage the app navigation state and handle history stack
import { NavigationContainer } from '@react-navigation/native';
// Import stack navigator creator to define transitions between screens (fades, slides)
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// Import bottom tab navigator creator to display the main application tabs
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// Import basic React Native layout components, loaders, and standard popups
import { View, ActivityIndicator, Alert } from 'react-native';
// Import Expo's Linking library to monitor and extract incoming deep link URLs (e.g., from web or QR codes)
import * as Linking from 'expo-linking';
// Import AsyncStorage to read and write persistent data directly onto the mobile storage (like cache keys)
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import custom utility functions to validate and process household invitation tokens with Firestore
import { validateInvitation, acceptInvitation } from './src/utils/invitationApi';
// Import ToastContext hooks to access functions for triggering user notification toasts
import { useToast } from './src/context/ToastContext';
// Import UserContext provider and hook to access the current logged-in user profile
import { UserProvider, useUser } from './src/context/UserContext';
// Import HouseholdContext provider and hook to fetch details about the user's roommate group
import { HouseholdProvider, useHousehold } from './src/context/HouseholdContext';
// Import ToastProvider to allow child screens to display toast alerts
import { ToastProvider } from './src/context/ToastContext';
// Import ThemeProvider and hooks to manage dark/light modes and fetch current theme status
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
// Import the custom global Toast component that floats over the active screen
import Toast from './src/components/Toast';
// Import the custom styled bottom navigation bar component
import BottomTabBar from './src/components/BottomTabBar';
// Import TS type definitions for the root stack parameter mapping
import { RootStackParamList } from './src/types';
// Import utility function to synchronize time with network clocks for accurate logs
import { syncTimeWithNetwork } from './src/utils/timeUtils';
// Import utility to register user token for push notifications
import { registerForPushNotificationsAsync } from './src/utils/notificationUtils';

// Import the auth/setup screens shown to logged-out users or users without a roommate group
import LoginScreen from './src/screens/LoginScreen';
import HouseholdSetupScreen from './src/screens/HouseholdSetupScreen';
import HouseholdSelectionScreen from './src/screens/HouseholdSelectionScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Import the main functional screens shown in the bottom navigation bar
import DashboardScreen from './src/screens/DashboardScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import ChoresScreen from './src/screens/ChoresScreen';
import ChatScreen from './src/screens/ChatScreen';

// Initialize the native Stack navigator using the parameter mapping types
const Stack = createNativeStackNavigator<RootStackParamList>();
// Initialize the Bottom Tab navigator
const Tab = createBottomTabNavigator();

/** 
 * Bottom-tab group — shown once a household is selected 
 * Displays the main operational areas of the application.
 */
function MainTabs() {
  // Retrieve details of the current household from the context
  const { householdData } = useHousehold();
  // Check if the current group is a "travel" household (e.g. temporary trip) rather than permanent home
  const isTravel = householdData?.type === 'travel';

  return (
    <Tab.Navigator
      // Use our custom styled tab bar instead of the default React Navigation bar
      tabBar={(props) => <BottomTabBar {...props} />}
      // Hide the default header (we implement custom headers inside each screen instead)
      screenOptions={{ headerShown: false }}
    >
      {/* Home dashboard feed screen */}
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      {/* Grocery list screen (hidden if the household is a temporary travel group) */}
      {!isTravel && <Tab.Screen name="Grocery" component={GroceryScreen} />}
      {/* Split expenses and bills screen */}
      <Tab.Screen name="Expenses"  component={ExpenseScreen} />
      {/* Chores rotas and cleaning tasks screen (hidden if on a temporary travel group) */}
      {!isTravel && <Tab.Screen name="Chores" component={ChoresScreen} />}
      {/* Real-time group chat screen. Tab bar is hidden when this chatroom is active */}
      <Tab.Screen name="Chat"      component={ChatScreen} options={{ tabBarStyle: { display: 'none' } }} />
    </Tab.Navigator>
  );
}

/**
 * RootNavigator deals with Authentication Routing logic.
 * It reads global login state and decides what screens the user is allowed to see.
 */
function RootNavigator() {
  // Grab login profile and load status from UserContext
  const { user, loading: userLoading } = useUser();
  // Grab household assignment ID and load status from HouseholdContext
  const { householdId, loading: householdLoading } = useHousehold();
  // Grab current theme state to style loading background
  const { isDark } = useTheme();

  // On mount, trigger network time synchronization
  useEffect(() => {
    syncTimeWithNetwork();
  }, []);

  // Whenever a user is successfully logged in, register device for push notifications
  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  // If we are currently checking Firestore Auth or fetching household details, render a full-screen loading spinner
  if (userLoading || householdLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Switch stack pages depending on auth state
  return (
    <Stack.Navigator
      id="root"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {!user ? (
        // Case 1: Not logged in. Only display the login/signup screen.
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !householdId ? (
        // Case 2: Logged in, but has not joined/created any household.
        <>
          <Stack.Screen name="HouseholdSelection" component={HouseholdSelectionScreen} />
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        </>
      ) : (
        // Case 3: Logged in AND has a household. Grant access to main tabs.
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="HouseholdSelection" component={HouseholdSelectionScreen} />
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

/**
 * App component initializes global layout and context providers.
 * Providers are nested so that downstream modules can access parents.
 */
function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <UserProvider>
              <HouseholdProvider>
                <NavigationContainer>
                  <ThemedApp />
                </NavigationContainer>
              </HouseholdProvider>
            </UserProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap the main app export with Sentry for crash tracking and performance metrics reporting
export default Sentry.wrap(App);

/** 
 * ThemedApp is an inner wrapper that reads the active Theme.
 * This is split from App() so that it lies inside NavigationContainer/ThemeProvider,
 * allowing it to access `useTheme` hooks and read deep links reactively.
 */
function ThemedApp() {
  // Grab dark/light mode state
  const { isDark } = useTheme();
  // Grab login profile and load status to handle invitations after user completes auth
  const { user, loading: userLoading } = useUser();
  // Grab active household and updater functions
  const { householdId, setHouseholdId } = useHousehold();
  // Grab toast dispatcher
  const { showToast } = useToast();

  // Helper function to extract invitation token from custom deep link URLs
  // Matches URLs like house-sync://invite/TOKEN or domain.com/invite/TOKEN
  const extractToken = (urlStr: string): string | null => {
    try {
      const match = urlStr.match(/\/invite\/([a-zA-Z0-9_\-]+)/);
      return match ? match[1] : null;
    } catch (e) {
      console.error("Error parsing invite URL:", e);
      return null;
    }
  };

  // Validates invitation token with Firestore backend and prompts the user to join
  const processPendingInvitation = async (token: string) => {
    try {
      showToast("Validating invitation link...", "info");
      // Check if the token is valid, exists, and hasn't expired
      const validation = await validateInvitation(token);
      if (!validation.valid) {
        Alert.alert("Invalid Link", validation.message || "This invitation link is invalid or expired.");
        return;
      }

      // Display a popup confirmation dialog to the user
      Alert.alert(
        "Join Household",
        `You have been invited to join the household "${validation.householdName}".\n\nWould you like to join?${
          householdId ? "\n\nNote: This will remove you from your current household." : ""
        }`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Join",
            // If they click Join, call Firestore API function to update roommate lists
            onPress: async () => {
              try {
                showToast("Joining household...", "info");
                const result = await acceptInvitation(token);
                if (result.success) {
                  // Switch the user's active context to the new household
                  setHouseholdId(result.householdId);
                  showToast(`Joined "${validation.householdName}" successfully!`, "success");
                } else {
                  showToast("Failed to join household", "error");
                }
              } catch (err: any) {
                console.error("Error joining household:", err);
                Alert.alert("Error Joining", err.message || "Something went wrong while joining.");
              }
            }
          }
        ]
      );
    } catch (err: any) {
      console.error("Error validating invitation:", err);
      showToast(err.message || "Error validating invitation link", "error");
    }
  };

  // Listen for incoming deep link URLs during app runtime
  useEffect(() => {
    const handleUrl = async (rawUrl: string) => {
      console.log("Deep link URL detected:", rawUrl);
      const token = extractToken(rawUrl);
      if (token) {
        // Save the token in local storage in case the user needs to register or log in first
        await AsyncStorage.setItem("pending_invite_token", token);
        if (!userLoading) {
          if (user) {
            // If they are logged in, remove token from storage and execute the join logic immediately
            await AsyncStorage.removeItem("pending_invite_token");
            processPendingInvitation(token);
          } else {
            showToast("Please log in to accept the invitation.", "info");
          }
        }
      }
    };

    // 1. Listen for deep links while the app is running in the background/foreground
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) {
        handleUrl(event.url);
      }
    });

    // 2. Check if the app was launched by clicking a deep link from a completely closed state
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleUrl(initialUrl);
      }
    });

    // Clean up link listeners on component unmount
    return () => {
      subscription.remove();
    };
  }, [user, userLoading]);

  // Check for any stored pending invitation links after login completes
  useEffect(() => {
    const checkPending = async () => {
      if (user && !userLoading) {
        const token = await AsyncStorage.getItem("pending_invite_token");
        if (token) {
          // Remove the token from cache so it is not processed twice
          await AsyncStorage.removeItem("pending_invite_token");
          processPendingInvitation(token);
        }
      }
    };
    checkPending();
  }, [user, userLoading]);

  return (
    <>
      {/* Set status bar style (battery indicator/time) dynamically based on theme mode */}
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Display authenticating screens */}
      <RootNavigator />
      {/* Floating toast notification overlays */}
      <Toast />
    </>
  );
}
