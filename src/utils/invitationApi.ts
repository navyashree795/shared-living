/*
 * FILE: src/utils/invitationApi.ts
 * PURPOSE: Invitation management API helper. It creates, validates, and processes household joining codes,
 *          ensuring data consistency using atomic Firestore transactional updates.
 * WHERE USED: Called by ThemedApp in App.tsx (deep linking handler) and by HouseholdSetupScreen.tsx.
 */

// Import Firestore document, subcollection, transaction, and field modifiers
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
// Import Firebase auth client SDK links
import { auth, db } from '../firebaseConfig';

export interface ValidateInvitationResponse {
  // True if token exists, is pending, and has not expired
  valid: boolean;
  // User readable warning detail message if invalid
  message?: string;
  // Associated household ID
  householdId?: string;
  // Associated household display name
  householdName?: string;
}

export interface AcceptInvitationResponse {
  // True if transaction finishes successfully
  success: boolean;
  // True if user was already a registered member of the target household
  alreadyMember?: boolean;
  // Associated household ID joined
  householdId: string;
}

/**
 * Generates a random 32-character hexadecimal token on the client.
 */
const generateHexToken = (): string => {
  const chars = '0123456789abcdef';
  let token = '';
  // Loop 32 times to build token string
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * 16)];
  }
  return token;
};

/**
 * Generates a pending invitation document in Firestore, valid for 7 days.
 */
export const createInvitation = async (householdId: string): Promise<string> => {
  // Grab current logged in user unique id
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to create invitations.');
  }

  try {
    // 1. Verify household document exists
    const householdDoc = await getDoc(doc(db, 'households', householdId));
    if (!householdDoc.exists()) {
      throw new Error('Household not found.');
    }

    const householdData = householdDoc.data();
    const members = householdData?.members || [];

    // 2. Verify current user belongs to the target household
    if (!members.includes(uid)) {
      throw new Error('You do not belong to this household.');
    }

    // 3. Generate invitation token and write details
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

    // Save invitation to DB root collection
    await setDoc(doc(db, 'invitations', token), invitationData);
    return token;
  } catch (error: any) {
    console.error('Error creating invitation client-side:', error);
    throw new Error(error.message || 'Failed to create invitation.');
  }
};

/**
 * Checks if a token is valid for joining a household.
 */
export const validateInvitation = async (token: string): Promise<ValidateInvitationResponse> => {
  // Check if token exists
  if (!token) {
    throw new Error('Invitation token is required.');
  }

  try {
    // Fetch invitation document from DB
    const inviteDoc = await getDoc(doc(db, 'invitations', token));
    if (!inviteDoc.exists()) {
      return { valid: false, message: 'Invalid invitation link.' };
    }

    const inviteData = inviteDoc.data();
    if (!inviteData) {
      return { valid: false, message: 'Invitation is empty.' };
    }

    // Verify invitation status is pending
    if (inviteData.status !== 'pending') {
      return { valid: false, message: 'This invitation has already been used.' };
    }

    // Check if invitation has expired
    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      // Mark invitation status as expired
      await updateDoc(doc(db, 'invitations', token), { status: 'expired' });
      return { valid: false, message: 'This invitation has expired.' };
    }

    // Fetch household document
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
 * Atomically consumes an invitation token, removes the user from their prior household,
 * and adds them to the new household members list in a single Firestore transaction.
 */
export const acceptInvitation = async (token: string): Promise<AcceptInvitationResponse> => {
  // Check if user is authenticated
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to accept invitations.');
  }

  try {
    // Execute atomic transaction to maintain database integrity
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

      // Check if user is already a member
      if (members.includes(uid)) {
        return { success: true, alreadyMember: true, householdId: inviteData.householdId };
      }

      // Fetch user profile document
      const userRef = doc(db, 'users', uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error('User profile not found.');
      }

      // Remove user from prior household members list if applicable
      const oldHouseholdId = userDoc.data()?.householdId;
      if (oldHouseholdId && oldHouseholdId !== inviteData.householdId) {
        const oldHouseholdRef = doc(db, 'households', oldHouseholdId);
        const oldHouseholdDoc = await transaction.get(oldHouseholdRef);
        if (oldHouseholdDoc.exists()) {
          const oldMembers = oldHouseholdDoc.data()?.members || [];
          const updatedOldMembers = oldMembers.filter((m: string) => m !== uid);
          // Update prior household member list to exclude user
          transaction.update(oldHouseholdRef, { members: updatedOldMembers });
        }
      }

      // Consume invitation token
      transaction.update(inviteRef, {
        status: 'accepted',
        usedBy: uid,
        usedAt: serverTimestamp()
      });

      // Append user to new household members array
      transaction.update(householdRef, {
        members: arrayUnion(uid)
      });

      // Update user profile link to point to new household ID
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
