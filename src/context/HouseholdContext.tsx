import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, getDocs, collection, query, where, documentId, orderBy, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Household, UserProfile } from '../types';
import { useUser } from './UserContext';

interface HouseholdContextType {
  householdId: string | null;
  householdData: Household | null;
  members: string[];
  memberProfiles: Record<string, UserProfile>;
  loading: boolean;
  setHouseholdId: (id: string | null) => void;
  getMemberName: (uid: string) => string;
  unreadMessagesCount: number;
  pendingGroceriesCount: number;
  pendingChoresCount: number;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdData, setHouseholdData] = useState<Household | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [storageLoading, setStorageLoading] = useState(false);
  const [firestoreLoading, setFirestoreLoading] = useState(false);

  const loading = storageLoading || firestoreLoading;

  // 0. Load saved householdId from AsyncStorage on login
  useEffect(() => {
    const loadSavedHousehold = async () => {
      if (!user) {
        setHouseholdId(null);
        return;
      }
      setStorageLoading(true);
      try {
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

  // 1. Intercept setHouseholdId to persist in AsyncStorage
  const changeHouseholdId = useCallback(async (id: string | null) => {
    setHouseholdId(id);
    if (user) {
      try {
        if (id) {
          await AsyncStorage.setItem(`lastOpenedHousehold_${user.uid}`, id);
        } else {
          await AsyncStorage.removeItem(`lastOpenedHousehold_${user.uid}`);
        }
      } catch (err) {
        console.error("Error saving last opened household:", err);
      }
    }
  }, [user]);

  // 2. Sync householdData when householdId changes
  useEffect(() => {
    if (!householdId) {
      setHouseholdData(null);
      setMemberProfiles({});
      return;
    }

    setFirestoreLoading(true);
    const unsub = onSnapshot(doc(db, 'households', householdId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Household;
        
        // Expiration check for travel households
        if (data.type === 'travel' && data.expiresAt) {
          const expirationTime = new Date(data.expiresAt).getTime();
          if (expirationTime <= Date.now()) {
            console.log("Household has expired! Clearing household state.");
            changeHouseholdId(null);
            setHouseholdData(null);
            setFirestoreLoading(false);
            return;
          }
        }

        setHouseholdData(data);
      } else {
        setHouseholdData(null);
        changeHouseholdId(null);
      }
      setFirestoreLoading(false);
    }, (err) => {
      console.error("Error subscribing to household:", err);
      setFirestoreLoading(false);
    });

    return unsub;
  }, [householdId, changeHouseholdId]);

  // 2. Fetch/Sync member profiles when members list changes
  const membersDeps = householdData?.members?.join(',') || '';

  useEffect(() => {
    const membersList = householdData?.members || [];
    if (membersList.length === 0) {
      setMemberProfiles({});
      return;
    }

    const q = query(
      collection(db, "users"),
      where(documentId(), "in", membersList)
    );
    const unsub = onSnapshot(q, (snap) => {
      const profiles: Record<string, UserProfile> = {};
      snap.forEach((doc) => {
        profiles[doc.id] = doc.data() as UserProfile;
      });
      setMemberProfiles(profiles);
    }, (err) => {
      console.error("Failed to sync member profiles:", err);
    });

    return unsub;
  }, [membersDeps]);


  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingGroceriesCount, setPendingGroceriesCount] = useState(0);
  const [pendingChoresCount, setPendingChoresCount] = useState(0);

  // 3. Sync unread chat message count
  useEffect(() => {
    if (!householdId || !user) {
      setUnreadMessagesCount(0);
      return;
    }
    const q = query(
      collection(db, "households", householdId, "messages"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.filter((docSnap) => {
        const data = docSnap.data();
        return (
          data.senderId !== user.uid &&
          (!data.readBy || !data.readBy.includes(user.uid))
        );
      }).length;
      setUnreadMessagesCount(count);
    }, (err) => {
      console.error("Failed to sync unread messages count:", err);
    });

    return unsub;
  }, [householdId, user]);

  // 4. Sync pending groceries count
  useEffect(() => {
    if (!householdId) {
      setPendingGroceriesCount(0);
      return;
    }
    const q = query(
      collection(db, "households", householdId, "groceries"),
      where("done", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingGroceriesCount(snap.size);
    }, (err) => {
      console.error("Failed to sync pending groceries count:", err);
    });

    return unsub;
  }, [householdId]);

  // 5. Sync pending chores count for current user
  useEffect(() => {
    if (!householdId || !user) {
      setPendingChoresCount(0);
      return;
    }
    const q = query(
      collection(db, "households", householdId, "chores"),
      where("assignedToUid", "==", user.uid),
      where("done", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });
      const count = snap.docs.filter((docSnap) => {
        const c = docSnap.data();
        if (c.targetDate) {
          const target = typeof c.targetDate.toDate === "function" ? c.targetDate.toDate() : new Date(c.targetDate);
          const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return targetDateOnly <= nowDateOnly;
        }
        return c.day?.includes(currentDay);
      }).length;
      setPendingChoresCount(count);
    }, (err) => {
      console.error("Failed to sync pending chores count:", err);
    });

    return unsub;
  }, [householdId, user]);

  const getMemberName = useCallback((uid: string) => {
    if (uid === user?.uid) return 'You';
    const profile = memberProfiles[uid];
    if (profile?.username) return profile.username;
    return profile?.email?.split('@')[0] || 'Member';
  }, [memberProfiles, user?.uid]);

  return (
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

export const useHousehold = (): HouseholdContextType => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
