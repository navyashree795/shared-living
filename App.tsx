import React from 'react';
import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { UserProvider, useUser } from './src/context/UserContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { RootStackParamList } from './src/types';
import { syncTimeWithNetwork } from './src/utils/timeUtils';
import { useEffect } from 'react';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HouseholdSetupScreen from './src/screens/HouseholdSetupScreen';
import HouseholdSelectionScreen from './src/screens/HouseholdSelectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import ChoresScreen from './src/screens/ChoresScreen';
import ChatScreen from './src/screens/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { user, loading } = useUser();

  useEffect(() => {
    syncTimeWithNetwork();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      id="root"
      screenOptions={{ headerShown: false }}
      initialRouteName={user ? "HouseholdSelection" : "Login"}
    >
      {user ? (
        <Stack.Group>
          <Stack.Screen name="HouseholdSelection" component={HouseholdSelectionScreen} />
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Grocery" component={GroceryScreen} />
          <Stack.Screen name="Expenses" component={ExpenseScreen} />
          <Stack.Screen name="Chores" component={ChoresScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <HouseholdProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </HouseholdProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
