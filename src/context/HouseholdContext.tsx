/*
 * FILE: src/context/HouseholdContext.tsx
 * PURPOSE: Global context provider that manages the active household state of the user. It tracks
 *          the selected household, downloads details/members profiles, and calculates badges (unread chats,
 *          pending groceries, due chores) in real time.
 * WHERE USED: Wrapped at the root level of the app in App.tsx. Any subcomponent can call `useHousehold()`
 *             to fetch household details, get members, or register callbacks to switch households.
 */

// Import React hooks for state, side effects, context, callbacks, and reference caching, plus ReactNode type
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// Import initialized Firestore database instance
import { db } from '../firebaseConfig';
// Import Firestore querying methods to construct queries, fetch documents, order results, and paginate
import { doc, onSnapshot, collection, query, where, documentId, orderBy, limit } from 'firebase/firestore';
// Import AsyncStorage to save the user's selected household ID directly on the device storage
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import typescript interfaces for Household data structures and UserProfiles
import { Household, UserProfile } from '../types';
// Import custom authentication hook to access the logged-in user profile
import { useUser } from './UserContext';

// Define the properties and functions exposed by the HouseholdContext
interface HouseholdContextType {
  // The string ID of the currently selected household (null if they are not in a household)
  householdId: string | null;
  // The household details fetched from Firestore (metadata, settings, invite codes)
  householdData: Household | null;
  // Flat list of member user IDs (UIDs) belonging to the active household
  members: string[];
  // Mapping dictionary of member UIDs to their detailed UserProfile documents
  memberProfiles: Record<string, UserProfile>;
  // True if loading the household ID from local storage or synchronizing Firestore listeners
  loading: boolean;
  // Callback function to switch or clear the active household
  setHouseholdId: (id: string | null) => void;
  // Helper function to convert a user UID into a display name (returns "You", username, or email alias)
  getMemberName: (uid: string) => string;
  // The number of chat messages sent by others that this user hasn't read yet
  unreadMessagesCount: number;
  // The number of grocery checklist items currently unchecked (done == false)
  pendingGroceriesCount: number;
  // The number of incomplete chores assigned to the logged-in user that are due today or overdue
  pendingChoresCount: number;
}

// Create the context container with an initial value of undefined
const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

/**
 * HouseholdProvider wraps application components to broadcast household information.
 */
export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  // Grab the logged-in user credential object to fetch user-specific household settings
  const { user } = useUser();
  // State hook to store the active household's ID
  const [householdId, setHouseholdId] = useState<string | null>(null);
  // State hook to store the active household's Firestore document details
  const [householdData, setHouseholdData] = useState<Household | null>(null);
  // State hook mapping UIDs to profile information for list rendering and message names
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  // Loader flag tracking AsyncStorage read progress
  const [storageLoading, setStorageLoading] = useState(false);
  // Loader flag tracking Firestore synchronization progress
  const [firestoreLoading, setFirestoreLoading] = useState(false);

  // Combined loading status: if either AsyncStorage or Firestore is loading, context is loading
  const loading = storageLoading || firestoreLoading;

  // 0. Load the user's last opened household ID from the device's persistent cache on login
  useEffect(() => {
    const loadSavedHousehold = async () => {
      // If user logs out, reset state immediately
      if (!user) {
        setHouseholdId(null);
        return;
      }
      setStorageLoading(true);
      try {
        // Attempt to fetch the stored ID using a user-unique cache key
        const savedId = await AsyncStorage.getItem(`lastOpenedHousehold_${user.uid}`);
        if (savedId) {
          setHouseholdId(savedId);
        }
      } catch (err) {
        console.error("Error loading last opened household:", err);
      } finally {
        setStorageLoading(false);
      }
    };
    loadSavedHousehold();
  }, [user]);

  // 1. Intercept household transitions to write/remove the cache key in AsyncStorage
  const changeHouseholdId = useCallback(async (id: string | null) => {
    // Update local state first to immediately trigger UI changes
    setHouseholdId(id);
    if (user) {
      try {
        if (id) {
          // If switching to a valid household, save it to device cache
          await AsyncStorage.setItem(`lastOpenedHousehold_${user.uid}`, id);
        } else {
          // If clearing household (e.g. leaving or deleting), remove cache key
          await AsyncStorage.removeItem(`lastOpenedHousehold_${user.uid}`);
        }
      } catch (err) {
        console.error("Error saving last opened household:", err);
      }
    }
  }, [user]);

  // 2. Sync the household document from Firestore in real-time when the active ID changes
  useEffect(() => {
    // If no household is selected, wipe local state and skip query
    if (!householdId) {
      setHouseholdData(null);
      setMemberProfiles({});
      return;
    }

    setFirestoreLoading(true);
    // Open a real-time Firestore listener to /households/{householdId}
    const unsub = onSnapshot(doc(db, 'households', householdId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Household;
        
        // Expiration check for temporary travel households (trips)
        if (data.type === 'travel' && data.expiresAt) {
          const expirationTime = new Date(data.expiresAt).getTime();
          // If the computed expiration time is in the past, auto-leave the household
          if (expirationTime <= Date.now()) {
            console.log("Household has expired! Clearing household state.");
            changeHouseholdId(null);
            setHouseholdData(null);
            setFirestoreLoading(false);
            return;
          }
        }

        // Save household details to state
        setHouseholdData(data);
      } else {
        // If the household document was deleted on the server, clear local selection
        setHouseholdData(null);
        changeHouseholdId(null);
      }
      setFirestoreLoading(false);
    }, (err) => {
      console.error("Error subscribing to household:", err);
      setFirestoreLoading(false);
    });

    // Clean up database subscription when householdId changes or component unmounts
    return unsub;
  }, [householdId, changeHouseholdId]);

  // Create a memoized dependency string representing the household member array.
  // This prevents the user profile syncing effect from re-running unnecessarily if reference pointer changes.
  const membersDeps = householdData?.members?.join(',') || '';

  // 2. Sync and load profile documents for all household members
  useEffect(() => {
    const membersList = householdData?.members || [];
    if (membersList.length === 0) {
      setMemberProfiles({});
      return;
    }

    // Chunk the membersList into sub-arrays of maximum 30 items.
    // Firestore "in" queries can only accept a maximum of 30 comparison values.
    const chunks: string[][] = [];
    for (let i = 0; i < membersList.length; i += 30) {
      chunks.push(membersList.slice(i, i + 30));
    }

    // Store unsubscribe methods for each query chunk to cancel them on cleanup
    const unsubscribes: (() => void)[] = [];
    // Accumulate profiles in an indexed dictionary to merge them when snaps fire
    const profilesMap: Record<number, Record<string, UserProfile>> = {};

    // Loop through each chunk of UIDs and establish real-time snapshot queries
    chunks.forEach((chunk, index) => {
      const q = query(
        collection(db, "users"),
        where(documentId(), "in", chunk)
      );
      
      const unsub = onSnapshot(q, (snap) => {
        const chunkProfiles: Record<string, UserProfile> = {};
        snap.forEach((doc) => {
          chunkProfiles[doc.id] = doc.data() as UserProfile;
        });

        // Store profiles loaded from this specific chunk
        profilesMap[index] = chunkProfiles;

        // Merge profiles from all active chunks to construct the final single dictionary
        const allProfiles: Record<string, UserProfile> = {};
        Object.values(profilesMap).forEach((chunkMap) => {
          Object.assign(allProfiles, chunkMap);
        });

        // Save merged dictionary to component state
        setMemberProfiles(allProfiles);
      }, (err) => {
        console.error(`Failed to sync member profiles for chunk ${index}:`, err);
      });

      unsubscribes.push(unsub);
    });

    // Clean up all active profile listeners on unmount or member list change
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [membersDeps]);


  // Initialize badge states to 0
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingGroceriesCount, setPendingGroceriesCount] = useState(0);
  const [pendingChoresCount, setPendingChoresCount] = useState(0);

  // 3. Sync unread chat message counts
  useEffect(() => {
    // If not logged in or not in a household, reset count to 0 and skip
    if (!householdId || !user) {
      setUnreadMessagesCount(0);
      return;
    }
    // Query the latest 20 messages sorted by date descending
    const q = query(
      collection(db, "households", householdId, "messages"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    // Listen to chat changes
    const unsub = onSnapshot(q, (snap) => {
      // Filter out messages sent by the logged-in user, or messages where the user's UID is in `readBy` list
      const count = snap.docs.filter((docSnap) => {
        const data = docSnap.data();
        return (
          data.senderId !== user.uid &&
          (!data.readBy || !data.readBy.includes(user.uid))
        );
      }).length;
      // Update state with calculated count
      setUnreadMessagesCount(count);
    }, (err) => {
      console.error("Failed to sync unread messages count:", err);
    });

    return unsub;
  }, [householdId, user]);

  // 4. Sync pending groceries count (unchecked items)
  useEffect(() => {
    if (!householdId) {
      setPendingGroceriesCount(0);
      return;
    }
    // Filter items that have not been bought (done == false)
    const q = query(
      collection(db, "households", householdId, "groceries"),
      where("done", "==", false)
    );
    // Listen to modifications and update grocery counts
    const unsub = onSnapshot(q, (snap) => {
      setPendingGroceriesCount(snap.size);
    }, (err) => {
      console.error("Failed to sync pending groceries count:", err);
    });

    return unsub;
  }, [householdId]);

  // 5. Sync due/overdue chores count assigned to the active user
  useEffect(() => {
    if (!householdId || !user) {
      setPendingChoresCount(0);
      return;
    }
    // Query chores assigned to the user that are incomplete (done == false)
    const q = query(
      collection(db, "households", householdId, "chores"),
      where("assignedToUid", "==", user.uid),
      where("done", "==", false)
    );
    // Establish listener
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      // Format abbreviation of today's weekday (e.g. "Mon", "Tue")
      const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
      
      // Filter chores that are either scheduled for today, weekly on today, or have a past deadline date
      const count = snap.docs.filter((docSnap) => {
        const c = docSnap.data();
        if (c.targetDate) {
          // Parse Firestore timestamp or Date object
          const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
          // Zero out hours/minutes to compare calendar dates
          const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          // True if the chore due date is today or in the past
          return targetDateOnly <= nowDateOnly;
        }
        // Fallback to checking the weekday string
        return c.day?.includes(currentDay);
      }).length;
      setPendingChoresCount(count);
    }, (err) => {
      console.error("Failed to sync pending chores count:", err);
    });

    return unsub;
  }, [householdId, user]);

  // Helper function to resolve UID strings into nice display labels
  const getMemberName = useCallback((uid: string) => {
    // If the UID matches the logged-in user, return "You"
    if (uid === user?.uid) return 'You';
    // Fetch profile mapping from memory state
    const profile = memberProfiles[uid];
    if (profile?.username) return profile.username;
    // Fallback: use first segment of email address (e.g., jeevan@gmail.com becomes "jeevan")
    return profile?.email?.split('@')[0] || 'Member';
  }, [memberProfiles, user?.uid]);

  return (
    // Pass state data and updater helpers down context provider
    <HouseholdContext.Provider 
      value={{ 
        householdId, 
        householdData, 
        members: householdData?.members || [], 
        memberProfiles, 
        loading, 
        setHouseholdId: changeHouseholdId,
        getMemberName,
        unreadMessagesCount,
        pendingGroceriesCount,
        pendingChoresCount
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

/**
 * Custom hook useHousehold gives immediate access to active household stats.
 * Throws error if used outside a HouseholdProvider.
 */
export const useHousehold = (): HouseholdContextType => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
