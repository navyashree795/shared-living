import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, getDocs, collection, query, where, documentId } from 'firebase/firestore';
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
        setHouseholdData(data);
      } else {
        setHouseholdData(null);
      }
      setFirestoreLoading(false);
    }, (err) => {
      console.error("Error subscribing to household:", err);
      setFirestoreLoading(false);
    });

    return unsub;
  }, [householdId]);

  // 2. Fetch/Sync member profiles when members list changes
  const membersDeps = householdData?.members?.join(',') || '';

  useEffect(() => {
    const membersList = householdData?.members || [];
    if (membersList.length === 0) {
      setMemberProfiles({});
      return;
    }

    const fetchProfiles = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where(documentId(), "in", membersList)
        );
        const querySnapshot = await getDocs(q);
        const profiles: Record<string, UserProfile> = {};
        querySnapshot.forEach((doc) => {
          profiles[doc.id] = doc.data() as UserProfile;
        });
        setMemberProfiles(profiles);
      } catch (err) {
        console.error("Failed to fetch member profiles:", err);
      }
    };

    fetchProfiles();
  }, [membersDeps]);


  const getMemberName = useCallback((uid: string) => {
    if (uid === user?.uid) return 'You';
    const profile = memberProfiles[uid];
    if (profile?.username) return `@${profile.username}`;
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
        getMemberName
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
