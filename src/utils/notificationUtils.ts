import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configure notification behavior for when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permissions and registers the device for Expo Push Notifications.
 * Saves the token to the current user's profile in Firestore.
 */
export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get permissions for push notifications!');
      return null;
    }
    
    try {
      if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        console.warn(
          'Android Remote Push Notifications are not supported in Expo Go (SDK 53+). ' +
          'To test remote push notifications, please run a custom Development Build (npm run android).'
        );
      } else {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: "6e612ca1-cfbc-4727-aadb-4f1283e2636d",
        })).data;

        const user = auth.currentUser;
        if (user && token) {
          await updateDoc(doc(db, 'users', user.uid), {
            pushToken: token
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Expo push token:', error);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Schedules a local device notification 5 minutes before the chore's targetDate.
 */
export async function scheduleChoreReminder(title: string, targetDate: Date) {
  try {
    const triggerTime = new Date(targetDate.getTime() - 5 * 60 * 1000); // 5 minutes prior
    
    if (triggerTime.getTime() <= Date.now()) {
      // If the target is less than 5 minutes away, do not schedule future alarm
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧹 Chore Reminder',
        body: `"${title}" is scheduled in 5 minutes!`,
        data: { screen: 'Chores' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
    
    return id;
  } catch (e) {
    console.error('Error scheduling local notification:', e);
    return null;
  }
}

/**
 * Cancels a scheduled local notification.
 */
export async function cancelChoreReminder(notificationId: string | null) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.error('Error cancelling local notification:', e);
  }
}

/**
 * Sends a remote push notification to a list of target Expo Push Tokens.
 */
export async function sendRemotePushNotification(targetTokens: string[], title: string, body: string) {
  const validTokens = targetTokens.filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return;

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high',
    android: {
      channelId: 'default',
    },
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('Error sending remote push notification via Expo:', e);
  }
}
