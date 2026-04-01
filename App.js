import React, { useState, useEffect } from 'react';
import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { auth } from './src/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HouseholdSetupScreen from './src/screens/HouseholdSetupScreen';
import HouseholdSelectionScreen from './src/screens/HouseholdSelectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import ChoresScreen from './src/screens/ChoresScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener watches Firebase. The moment the user logs in or out, 
    // it updates the state, which automatically changes the active screens below.
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            // ONLY rendered if the user is logged in
            <>
              <Stack.Screen name="HouseholdSelection" component={HouseholdSelectionScreen} />
              <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="Grocery" component={GroceryScreen} />
              <Stack.Screen name="Expenses" component={ExpenseScreen} />
              <Stack.Screen name="Chores" component={ChoresScreen} />
            </>
          ) : (
            // ONLY rendered if the user is NOT logged in
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}