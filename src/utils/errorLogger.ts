import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

export interface CrashReport {
  message: string;
  stack?: string;
  componentStack?: string;
  isFatal: boolean;
  timestamp: any;
  device: {
    brand: string | null;
    model: string | null;
    osName: string | null;
    osVersion: string | null;
    platform: typeof Platform.OS;
    isDevice: boolean;
  };
  user: {
    uid: string | null;
    email: string | null;
  };
}

/**
 * Logs a JS crash or error report with device telemetry directly to Firestore.
 */
export async function logCrashToFirestore(error: Error, isFatal: boolean, componentStack?: string) {
  try {
    const user = auth.currentUser;
    
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

    // Save to crashes collection
    await addDoc(collection(db, 'crashes'), report);
    console.log('Crash report successfully logged to Firestore.');
  } catch (dbErr) {
    console.error('Failed to write crash report to Firestore:', dbErr);
  }
}

/**
 * Global handler registrations for unhandled JS errors and promise rejections.
 */
export function initGlobalErrorTracking() {
  // 1. Initialize Sentry
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '', // optional in dev, required in production
    tracesSampleRate: 1.0,
    _experiments: {
      profilesSampleRate: 1.0,
    },
  });

  console.log('Sentry SDK successfully initialized.');

  // 2. Catch JS Errors and log to Firestore as well as Sentry
  const originalErrorHandler = (global as any).ErrorUtils?.getGlobalHandler();
  (global as any).ErrorUtils?.setGlobalHandler(async (error: any, isFatal?: boolean) => {
    console.warn('Caught global unhandled error:', error?.message || error);
    
    const parsedError = error instanceof Error ? error : new Error(String(error));
    
    // Log to Sentry
    Sentry.captureException(parsedError, {
      extra: { isFatal },
    });

    // Log to Firestore
    await logCrashToFirestore(parsedError, !!isFatal);
    
    // Pass control to original handler if it exists
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    }
  });

  // 3. Catch Unhandled Promise Rejections
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

        // Log to Firestore
        await logCrashToFirestore(parsedError, false, 'Unhandled Promise Rejection');
      },
      onHandled: () => {},
    });
  } catch (err) {
    console.error('Failed to initialize promise rejection tracking:', err);
  }
}

/**
 * Updates Sentry user context when user logs in/out.
 */
export function setSentryUser(uid: string | null, email: string | null) {
  if (uid) {
    Sentry.setUser({
      id: uid,
      email: email || undefined,
    });
    console.log(`Sentry user context updated for uid: ${uid}`);
  } else {
    Sentry.setUser(null);
    console.log('Sentry user context cleared.');
  }
}
