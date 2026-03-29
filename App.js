import React, { useState, useEffect } from 'react';
import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { View, ActivityIndicator } from 'react-native';
import { auth, db } from './src/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import LoginScreen from './src/screens/LoginScreen';
import HouseholdSetupScreen from './src/screens/HouseholdSetupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import ChoresScreen from './src/screens/ChoresScreen';

const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

export default function App() {
  const [user, setUser] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [householdData, setHouseholdData] = useState(null);
  const [loading, setLoading] = useState(true);

  const linking = {
    prefixes: [prefix, 'shared-living://'],
    config: {
      screens: {
        HouseholdSetup: 'join',
      },
    },
  };

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const hid = docSnap.data().householdId;
            setHouseholdId(hid);
            if (hid) {
              // Also pull household data for members list
              const { getDoc } = await import('firebase/firestore');
              const hhSnap = await getDoc(doc(db, 'households', hid));
              if (hhSnap.exists()) setHouseholdData(hhSnap.data());
            }
          } else {
            setHouseholdId(null);
          }
          setLoading(false);
        }, (error) => {
            console.error("Error listening to user doc: ", error);
            setLoading(false);
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        setHouseholdId(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
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
      <StatusBar style="light" />
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : !householdId ? (
            <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
          ) : (
            <>
              <Stack.Screen name="Dashboard">
                {props => <DashboardScreen {...props} householdId={householdId} householdData={householdData} />}
              </Stack.Screen>
              <Stack.Screen name="Grocery" component={GroceryScreen} />
              <Stack.Screen name="Expenses" component={ExpenseScreen} />
              <Stack.Screen name="Chores" component={ChoresScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
