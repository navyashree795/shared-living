import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export const useHouseholdMembers = (members) => {
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!members || members.length === 0) {
        setLoading(false);
        return;
      }
      
      const profiles = {};
      for (const uid of members) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) profiles[uid] = snap.data();
        } catch (e) {
          console.error(`Error fetching profile for ${uid}:`, e);
        }
      }
      setMemberProfiles(profiles);
      setLoading(false);
    };

    fetchProfiles();
  }, [members]);

  const getMemberName = (uid) => {
    if (uid === auth.currentUser?.uid) return 'You';
    const profile = memberProfiles[uid];
    if (profile?.username) return `@${profile.username}`;
    const fallback = profile?.email?.split('@')[0] || 'Member';
    return fallback;
  };

  return { memberProfiles, getMemberName, loading };
};
