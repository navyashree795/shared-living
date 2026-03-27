import React from 'react';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  return (
    <>
      {/* Set status bar to light-content for our dark mode login UI */}
      <StatusBar style="light" />
      <LoginScreen />
    </>
  );
}
