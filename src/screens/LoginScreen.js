import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';

// Ensure WebBrowser is ready to handle the auth redirect
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Build the correct redirect URI for Expo Go (uses the Expo auth proxy)
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = Google.useAuthRequest({
    // Use the ID from your "Web Application" client in Google Cloud Console
    webClientId: '362366255638-4fhqghs0c6cp9j0mcfovd2uf8173ckqr.apps.googleusercontent.com',

    // Use the ID from your "Android" client (the one with your SHA-1)
    androidClientId: '362366255638-q2b0nftkhnrte1858hf8guqnb6verqjk.apps.googleusercontent.com',

    // This matches the 'scheme' in your app.json
    redirectUri: AuthSession.makeRedirectUri({
      scheme: 'shared-living',
    }),
  });
  // Listen to the response from Google
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      setLoading(true);
      signInWithCredential(auth, credential)
        .then((userCredential) => {
          // Successfully signed in with Firebase
          console.log("Logged in with Firebase:", userCredential.user.email);
        })
        .catch(error => {
          console.error("Firebase Login Error", error);
          Alert.alert("Authentication Failed", error.message);
          setLoading(false);
        });
    }
  }, [response]);

  // Auth State Listener to see if a user is currently logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Stop loading if state is resolved
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* App Branding */}
        <View style={styles.header}>
          <Text style={styles.title}>Shared Living</Text>
          <Text style={styles.subtitle}>Manage household tasks seamlessly together.</Text>
        </View>

        {/* Auth Section */}
        {user ? (
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.emailText}>{user.email}</Text>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => auth.signOut()}
            >
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.callToAction}>Get Started Today</Text>

            <TouchableOpacity
              disabled={!request}
              style={styles.googleButton}
              onPress={() => promptAsync({ useProxy: true })}
            >
              {/* Note: In a real app, use the official Google 'G' logo image here */}
              <View style={styles.googleIconPlaceholder}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Premium dark mode background
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  callToAction: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 24,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 100, // Pill shaped
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  googleIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleIconText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  googleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    paddingRight: 36, // Balance the icon width
  },
  termsText: {
    fontSize: 12,
    color: '#6e6e73',
    textAlign: 'center',
    lineHeight: 18,
  },
  welcomeText: {
    fontSize: 18,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#303033',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#404044',
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    color: '#A0A0A0',
    fontSize: 16,
  }
});
