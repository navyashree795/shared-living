import React, { useEffect } from 'react';
import './global.css';
import * as Sentry from '@sentry/react-native';
import { initGlobalErrorTracking } from './src/utils/errorLogger';
import { StatusBar } from 'expo-status-bar';

// Initialize global crash analytics and error tracking
initGlobalErrorTracking();
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { UserProvider, useUser } from './src/context/UserContext';
import { HouseholdProvider, useHousehold } from './src/context/HouseholdContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import Toast from './src/components/Toast';
import BottomTabBar from './src/components/BottomTabBar';
import { RootStackParamList } from './src/types';
import { syncTimeWithNetwork } from './src/utils/timeUtils';
import { registerForPushNotificationsAsync } from './src/utils/notificationUtils';

// Auth / setup screens
import LoginScreen from './src/screens/LoginScreen';
import HouseholdSetupScreen from './src/screens/HouseholdSetupScreen';
import HouseholdSelectionScreen from './src/screens/HouseholdSelectionScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Main tab screens
import DashboardScreen from './src/screens/DashboardScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import ChoresScreen from './src/screens/ChoresScreen';
import ChatScreen from './src/screens/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

/** Bottom-tab group — shown once a household is selected */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Grocery"   component={GroceryScreen} />
      <Tab.Screen name="Expenses"  component={ExpenseScreen} />
      <Tab.Screen name="Chores"    component={ChoresScreen} />
      <Tab.Screen name="Chat"      component={ChatScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useUser();
  const { householdId } = useHousehold();
  const { isDark } = useTheme();

  useEffect(() => {
    syncTimeWithNetwork();
  }, []);

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      id="root"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !householdId ? (
        <>
          <Stack.Screen name="HouseholdSelection" component={HouseholdSelectionScreen} />
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        </>
      ) : (
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

export default Sentry.wrap(App);

/** Reads theme inside NavigationContainer so StatusBar colour is reactive */
function ThemedApp() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <Toast />
    </>
  );
}
