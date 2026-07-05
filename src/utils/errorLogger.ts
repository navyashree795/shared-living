/*
 * FILE: src/utils/errorLogger.ts
 * PURPOSE: Global error logger and crash tracking hub. It captures uncaught JS exceptions,
 *          unhandled promise rejections, and logs telemetry details directly to Firestore and Sentry.
 * WHERE USED: Initialized at the very top of App.tsx to catch early startup exceptions.
 */

// Import database credentials and authentication modules
import { db, auth } from '../firebaseConfig';
// Import Firestore collection insertion queries
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
// Import Expo device descriptors library
import * as Device from 'expo-device';
// Import React Native Platform hooks
import { Platform } from 'react-native';
// Import Sentry crash reporting SDK
import * as Sentry from '@sentry/react-native';

export interface CrashReport {
  // Description summary of the thrown error
  message: string;
  // Compilation stack trace
  stack?: string;
  // React component mount stack trace if occurring inside components
  componentStack?: string;
  // True if this error crashed the application process
  isFatal: boolean;
  // Firestore server timestamp of logging
  timestamp: any;
  // Telemetry details about the user's phone device
  device: {
    brand: string | null;
    model: string | null;
    osName: string | null;
    osVersion: string | null;
    platform: typeof Platform.OS;
    isDevice: boolean;
  };
  // Metadata about who was logged in when crash occurred
  user: {
    uid: string | null;
    email: string | null;
  };
}

/**
 * Formats and writes a telemetry crash report to the Firestore '/crashes' collection.
 */
export async function logCrashToFirestore(error: Error, isFatal: boolean, componentStack?: string) {
  try {
    // Grab current user reference
    const user = auth.currentUser;
    
    // Assemble structured crash report metadata payload
    const report: CrashReport = {
      message: error?.message || 'Unknown Error',
      stack: error?.stack || new Error().stack || '',
      componentStack: componentStack || '',
      isFatal,
      timestamp: serverTimestamp(),
      device: {
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        osName: Device.osName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
        isDevice: Device.isDevice,
      },
      user: {
        uid: user ? user.uid : null,
        email: user ? user.email : null,
      },
    };

    // Save report in Firestore root collection
    await addDoc(collection(db, 'crashes'), report);
    console.log('Crash report successfully logged to Firestore.');
  } catch (dbErr) {
    console.error('Failed to write crash report to Firestore:', dbErr);
  }
}

/**
 * Registers global listeners to intercept unhandled exceptions and promise rejections.
 */
export function initGlobalErrorTracking() {
  // 1. Initialize Sentry client configuration
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '', // optional in development builds
    tracesSampleRate: 1.0,
    _experiments: {
      profilesSampleRate: 1.0,
    },
  });

  console.log('Sentry SDK successfully initialized.');

  // 2. Intercept unhandled JavaScript runtime errors
  const originalErrorHandler = (global as any).ErrorUtils?.getGlobalHandler();
  (global as any).ErrorUtils?.setGlobalHandler(async (error: any, isFatal?: boolean) => {
    console.warn('Caught global unhandled error:', error?.message || error);
    
    // Ensure error instance conforms to Error interface
    const parsedError = error instanceof Error ? error : new Error(String(error));
    
    // Log exception to Sentry
    Sentry.captureException(parsedError, {
      extra: { isFatal },
    });

    // Write crash details to our database
    await logCrashToFirestore(parsedError, !!isFatal);
    
    // Pass control to the default OS handler to continue crash behavior
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    }
  });

  // 3. Intercept unhandled Promise Rejections (e.g. failed async network requests)
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: async (id: number, error: any) => {
        console.warn('Caught unhandled promise rejection:', error?.message || error);
        
        const parsedError = error instanceof Error ? error : new Error(JSON.stringify(error));
        
        // Log to Sentry
        Sentry.captureException(parsedError, {
          tags: { type: 'UnhandledPromiseRejection' }
        });

        // Write details to our database
        await logCrashToFirestore(parsedError, false, 'Unhandled Promise Rejection');
      },
      onHandled: () => {},
    });
  } catch (err) {
    console.error('Failed to initialize promise rejection tracking:', err);
  }
}

/**
 * Updates Sentry session context with user information.
 */
export function setSentryUser(uid: string | null, email: string | null) {
  // If active user session details are passed
  if (uid) {
    Sentry.setUser({
      id: uid,
      email: email || undefined,
    });
    console.log(`Sentry user context updated for uid: ${uid}`);
  // If logging out user
  } else {
    Sentry.setUser(null);
    console.log('Sentry user context cleared.');
  }
}
