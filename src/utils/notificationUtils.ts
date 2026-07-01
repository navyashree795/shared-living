import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { ItineraryItem } from '../types';

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
          projectId: Constants.expoConfig?.extra?.eas?.projectId || "361ec070-905c-40e3-a8fe-a1f271449b2b",
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

/**
 * Parses travel itinerary date string (e.g. "YYYY-MM-DD") and time string (e.g. "10:00 AM")
 * into a valid JavaScript Date object.
 */
export function parseItineraryDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const dateMatch = dateStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (!dateMatch) return null;
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed month
    const day = parseInt(dateMatch[3], 10);

    const timeMatch = timeStr.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
    let hours = 0;
    let minutes = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }

    return new Date(year, month, day, hours, minutes, 0, 0);
  } catch (e) {
    console.error("Failed to parse itinerary date/time:", e);
    return null;
  }
}

/**
 * Automatically syncs device local notifications for approved future travel itinerary items.
 */
export async function syncItineraryReminders(items: ItineraryItem[]) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const itineraryNotifs = scheduled.filter(n => n.content.data?.itineraryId);

    const activeApprovedFutureItems = new Map<string, ItineraryItem>();
    const now = Date.now();

    items.forEach(item => {
      if (!item.approved) return;
      
      const eventDate = parseItineraryDateTime(item.date, item.time);
      if (!eventDate) return;

      if (eventDate.getTime() > now) {
        activeApprovedFutureItems.set(item.id, item);
      }
    });

    // Cancel notifications for items that were deleted, unapproved, or are now in the past
    for (const notif of itineraryNotifs) {
      const itineraryId = notif.content.data.itineraryId as string;
      const activeItem = activeApprovedFutureItems.get(itineraryId);
      
      if (!activeItem) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      } else {
        if (notif.content.data.date !== activeItem.date || notif.content.data.time !== activeItem.time) {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    }

    // Schedule reminders for items that don't have one scheduled yet
    const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const currentIds = new Set(
      currentScheduled
        .map(n => n.content.data?.itineraryId)
        .filter(Boolean)
    );

    for (const [id, item] of activeApprovedFutureItems.entries()) {
      if (currentIds.has(id)) {
        continue;
      }

      const eventDate = parseItineraryDateTime(item.date, item.time);
      if (!eventDate) continue;

      const triggerTime = new Date(eventDate.getTime() - 30 * 60 * 1000); // 30 minutes prior
      const hasTriggerPassed = triggerTime.getTime() <= now;

      const trigger = hasTriggerPassed 
        ? null 
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerTime,
          };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✈️ Trip Activity Reminder',
          body: `"${item.activity}" starts at ${item.time}!`,
          data: { 
            itineraryId: item.id, 
            date: item.date, 
            time: item.time, 
            screen: 'Dashboard' 
          },
        },
        trigger: trigger as any,
      });
    }
  } catch (e) {
    console.error('Error syncing itinerary reminders:', e);
  }
}

