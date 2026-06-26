import * as Crypto from 'expo-crypto';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

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

/**
 * Call client-side Firestore to create an invitation token for a household.
 */
export const createInvitation = async (householdId: string): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to create invitations.');
  }

  // Generate unique token (UUID v4)
  const token = Crypto.randomUUID();

  // Create document in "invitations" collection
  const inviteRef = doc(db, 'invitations', token);
  await setDoc(inviteRef, {
    token,
    householdId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    // Expiration date: 7 days from now
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    status: 'pending',
    usedBy: null,
    usedAt: null,
  });

  return token;
};

/**
 * Call client-side Firestore to validate an invitation token.
 */
export const validateInvitation = async (token: string): Promise<ValidateInvitationResponse> => {
  if (!token) {
    throw new Error('Invitation token is required.');
  }

  try {
    const inviteRef = doc(db, 'invitations', token);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      return { valid: false, message: 'Invalid invitation link.' };
    }

    const inviteData = inviteSnap.data();
    if (!inviteData) {
      return { valid: false, message: 'Invitation is empty.' };
    }

    if (inviteData.status !== 'pending') {
      return { valid: false, message: 'This invitation has already been used.' };
    }

    // Check expiration date
    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      // Update status to expired
      await updateDoc(inviteRef, { status: 'expired' });
      return { valid: false, message: 'This invitation has expired.' };
    }

    // Fetch household details
    const householdRef = doc(db, 'households', inviteData.householdId);
    const householdSnap = await getDoc(householdRef);
    if (!householdSnap.exists()) {
      return { valid: false, message: 'Household no longer exists.' };
    }

    const householdData = householdSnap.data();

    return {
      valid: true,
      householdId: inviteData.householdId,
      householdName: householdData?.name || 'Shared Space',
    };
  } catch (error: any) {
    console.error('Error validating invitation client-side:', error);
    throw new Error(error.message || 'Failed to validate invitation.');
  }
};

/**
 * Call client-side Firestore to accept an invitation token and join the household.
 */
export const acceptInvitation = async (token: string): Promise<AcceptInvitationResponse> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to accept invitations.');
  }

  try {
    // 1. Fetch the invitation
    const inviteRef = doc(db, 'invitations', token);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invalid invitation.');
    }

    const inviteData = inviteSnap.data();
    if (!inviteData) {
      throw new Error('Invitation data is empty.');
    }

    if (inviteData.status !== 'pending') {
      throw new Error('This invitation has already been used.');
    }

    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      await updateDoc(inviteRef, { status: 'expired' });
      throw new Error('This invitation has expired.');
    }

    const householdId = inviteData.householdId;

    // 2. Fetch the household
    const householdRef = doc(db, 'households', householdId);
    const householdSnap = await getDoc(householdRef);
    if (!householdSnap.exists()) {
      throw new Error('Household no longer exists.');
    }

    const householdData = householdSnap.data();
    const members = householdData?.members || [];

    if (members.includes(uid)) {
      return { success: true, alreadyMember: true, householdId };
    }

    // 3. Fetch user profile to see if they belong to a previous household
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('User profile not found.');
    }

    const oldHouseholdId = userSnap.data()?.householdId;

    // 4. Perform updates atomically using a WriteBatch
    const batch = writeBatch(db);

    // Update invitation doc
    batch.update(inviteRef, {
      status: 'accepted',
      usedBy: uid,
      usedAt: serverTimestamp(),
    });

    // Add user to new household members list
    batch.update(householdRef, {
      members: arrayUnion(uid),
    });

    // Update user profile householdId
    batch.set(userRef, { householdId }, { merge: true });

    // Remove user from previous household if they were in one
    if (oldHouseholdId && oldHouseholdId !== householdId) {
      const oldHouseholdRef = doc(db, 'households', oldHouseholdId);
      batch.update(oldHouseholdRef, {
        members: arrayRemove(uid),
      });
    }

    await batch.commit();

    return { success: true, householdId };
  } catch (error: any) {
    console.error('Error accepting invitation client-side:', error);
    throw new Error(error.message || 'Failed to accept invitation.');
  }
};
