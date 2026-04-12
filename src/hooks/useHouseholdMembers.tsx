import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
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
        const profiles: Record<string, UserProfile> = {};
        
        await Promise.all(
          members.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, 'users', uid));
              if (userSnap.exists()) {
                profiles[uid] = userSnap.data() as UserProfile;
              }
            } catch (err) {
              console.error(`Failed to fetch user ${uid}:`, err);
            }
          })
        );
        
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
