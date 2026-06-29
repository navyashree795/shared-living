import { registerRootComponent } from 'expo';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './src/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import App from './App';

const LOCATION_TASK_NAME = 'background-location-task';

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocationTask] Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;

      try {
        const userUid = await AsyncStorage.getItem('user_uid');
        const homeLocationStr = await AsyncStorage.getItem('home_location');
        const lastStatus = await AsyncStorage.getItem('last_presence_status');

        if (userUid && homeLocationStr) {
          const homeLocation = JSON.parse(homeLocationStr);
          const distance = getDistanceInMeters(
            latitude,
            longitude,
            homeLocation.latitude,
            homeLocation.longitude
          );

          const isInside = distance <= 100; // 100 meters
          const nextStatus = isInside ? 'home' : 'out';

          const shouldUpdate =
            (nextStatus === 'home' && (lastStatus === 'out' || lastStatus === 'away')) ||
            (nextStatus === 'out' && (lastStatus === 'home' || lastStatus === 'sleeping'));

          if (shouldUpdate) {
            console.log(`[BackgroundLocationTask] Presence changed: ${nextStatus}`);
            const userDocRef = doc(db, 'users', userUid);
            await updateDoc(userDocRef, { status: nextStatus });
            await AsyncStorage.setItem('last_presence_status', nextStatus);
          }
        }
      } catch (err) {
        console.error('[BackgroundLocationTask] Failed to process background location:', err);
      }
    }
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
