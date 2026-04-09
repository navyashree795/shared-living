import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { UserProfile } from '../types';

export const useHouseholdMembers = (members: string[] | undefined) => {
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!members || members.length === 0) {
        setMemberProfiles({});
        setLoading(false);
        return;
      }
      
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', 'in', members));
        const querySnapshot = await getDocs(q);
        
        const profiles: Record<string, UserProfile> = {};
        querySnapshot.forEach((doc) => {
          profiles[doc.id] = doc.data() as UserProfile;
        });
        
        setMemberProfiles(profiles);
      } catch (e) {
        console.error("Error fetching household profiles:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [members]);

  const getMemberName = (uid: string) => {
    if (uid === auth.currentUser?.uid) return 'You';
    const profile = memberProfiles[uid];
    if (profile?.username) return `@${profile.username}`;
    const fallback = profile?.email?.split('@')[0] || 'Member';
    return fallback;
  };

  return { memberProfiles, getMemberName, loading };
};
