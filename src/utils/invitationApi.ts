import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp, 
  arrayUnion 
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export interface ValidateInvitationResponse {
  valid: boolean;
  message?: string;
  householdId?: string;
  householdName?: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  alreadyMember?: boolean;
  householdId: string;
}

// Helper to generate a 32-character random hex token on the client
const generateHexToken = (): string => {
  const chars = '0123456789abcdef';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * 16)];
  }
  return token;
};

/**
 * Create an invitation token for a household directly in Firestore.
 */
export const createInvitation = async (householdId: string): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to create invitations.');
  }

  try {
    // 1. Verify household exists and fetch its data
    const householdDoc = await getDoc(doc(db, 'households', householdId));
    if (!householdDoc.exists()) {
      throw new Error('Household not found.');
    }

    const householdData = householdDoc.data();
    const members = householdData?.members || [];

    // 2. Verify current user's membership in the household
    if (!members.includes(uid)) {
      throw new Error('You do not belong to this household.');
    }

    // 3. Generate token and set invitation doc
    const token = generateHexToken();
    const invitationData = {
      token,
      householdId,
      createdBy: uid,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days expiration
      status: 'pending',
      usedBy: null,
      usedAt: null
    };

    await setDoc(doc(db, 'invitations', token), invitationData);
    return token;
  } catch (error: any) {
    console.error('Error creating invitation client-side:', error);
    throw new Error(error.message || 'Failed to create invitation.');
  }
};

/**
 * Validate an invitation token directly from Firestore.
 */
export const validateInvitation = async (token: string): Promise<ValidateInvitationResponse> => {
  if (!token) {
    throw new Error('Invitation token is required.');
  }

  try {
    const inviteDoc = await getDoc(doc(db, 'invitations', token));
    if (!inviteDoc.exists()) {
      return { valid: false, message: 'Invalid invitation link.' };
    }

    const inviteData = inviteDoc.data();
    if (!inviteData) {
      return { valid: false, message: 'Invitation is empty.' };
    }

    if (inviteData.status !== 'pending') {
      return { valid: false, message: 'This invitation has already been used.' };
    }

    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      await updateDoc(doc(db, 'invitations', token), { status: 'expired' });
      return { valid: false, message: 'This invitation has expired.' };
    }

    const householdDoc = await getDoc(doc(db, 'households', inviteData.householdId));
    if (!householdDoc.exists()) {
      return { valid: false, message: 'Household no longer exists.' };
    }

    const householdData = householdDoc.data();
    return {
      valid: true,
      householdId: inviteData.householdId,
      householdName: householdData?.name || 'Shared Space'
    };
  } catch (error: any) {
    console.error('Error validating invitation client-side:', error);
    throw new Error(error.message || 'Failed to validate invitation.');
  }
};

/**
 * Accept an invitation and join the household atomically using a Firestore transaction.
 */
export const acceptInvitation = async (token: string): Promise<AcceptInvitationResponse> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to accept invitations.');
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const inviteRef = doc(db, 'invitations', token);
      const inviteDoc = await transaction.get(inviteRef);

      if (!inviteDoc.exists()) {
        throw new Error('Invalid invitation.');
      }

      const inviteData = inviteDoc.data();
      if (!inviteData) {
        throw new Error('Invitation data is empty.');
      }

      if (inviteData.status !== 'pending') {
        throw new Error('Invitation has already been used.');
      }

      const expiresAt = inviteData.expiresAt.toDate();
      if (expiresAt < new Date()) {
        transaction.update(inviteRef, { status: 'expired' });
        throw new Error('Invitation has expired.');
      }

      const householdRef = doc(db, 'households', inviteData.householdId);
      const householdDoc = await transaction.get(householdRef);

      if (!householdDoc.exists()) {
        throw new Error('Household no longer exists.');
      }

      const householdData = householdDoc.data();
      const members = householdData?.members || [];

      if (members.includes(uid)) {
        return { success: true, alreadyMember: true, householdId: inviteData.householdId };
      }

      const userRef = doc(db, 'users', uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('User profile not found.');
      }

      // If user belongs to a different household, remove them from that household first
      const oldHouseholdId = userDoc.data()?.householdId;
      if (oldHouseholdId && oldHouseholdId !== inviteData.householdId) {
        const oldHouseholdRef = doc(db, 'households', oldHouseholdId);
        const oldHouseholdDoc = await transaction.get(oldHouseholdRef);
        if (oldHouseholdDoc.exists()) {
          const oldMembers = oldHouseholdDoc.data()?.members || [];
          const updatedOldMembers = oldMembers.filter((m: string) => m !== uid);
          transaction.update(oldHouseholdRef, { members: updatedOldMembers });
        }
      }

      // Atomically update invitation status, add member to household, and set user's householdId
      transaction.update(inviteRef, {
        status: 'accepted',
        usedBy: uid,
        usedAt: serverTimestamp()
      });

      transaction.update(householdRef, {
        members: arrayUnion(uid)
      });

      transaction.update(userRef, {
        householdId: inviteData.householdId
      });

      return { success: true, householdId: inviteData.householdId };
    });
  } catch (error: any) {
    console.error('Error accepting invitation client-side:', error);
    throw new Error(error.message || 'Failed to accept invitation.');
  }
};
