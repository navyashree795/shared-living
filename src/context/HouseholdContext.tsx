import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, getDocs, collection, query, where, documentId } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(false);

  // 0. Clear householdId when user logs out
  useEffect(() => {
    if (!user) {
      setHouseholdId(null);
    }
  }, [user]);

  // 1. Sync householdData when householdId changes
  useEffect(() => {
    if (!householdId) {
      setHouseholdData(null);
      setMemberProfiles({});
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(doc(db, 'households', householdId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Household;
        setHouseholdData(data);
      } else {
        setHouseholdData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing to household:", err);
      setLoading(false);
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
        setHouseholdId,
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
