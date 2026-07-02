import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebaseConfig';

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
 * Call backend Cloud Function to create an invitation token for a household.
 */
export const createInvitation = async (householdId: string): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to create invitations.');
  }

  try {
    const createInviteCallable = httpsCallable<{ householdId: string }, { token: string }>(functions, 'createInvitation');
    const result = await createInviteCallable({ householdId });
    return result.data.token;
  } catch (error: any) {
    console.error('Error creating invitation via Cloud Function:', error);
    throw new Error(error.message || 'Failed to create invitation.');
  }
};

/**
 * Call backend Cloud Function to validate an invitation token.
 */
export const validateInvitation = async (token: string): Promise<ValidateInvitationResponse> => {
  if (!token) {
    throw new Error('Invitation token is required.');
  }

  try {
    const validateInviteCallable = httpsCallable<{ token: string }, ValidateInvitationResponse>(functions, 'validateInvitation');
    const result = await validateInviteCallable({ token });
    return result.data;
  } catch (error: any) {
    console.error('Error validating invitation via Cloud Function:', error);
    throw new Error(error.message || 'Failed to validate invitation.');
  }
};

/**
 * Call backend Cloud Function to accept an invitation token and join the household.
 */
export const acceptInvitation = async (token: string): Promise<AcceptInvitationResponse> => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User must be logged in to accept invitations.');
  }

  try {
    const acceptInviteCallable = httpsCallable<{ token: string }, AcceptInvitationResponse>(functions, 'acceptInvitation');
    const result = await acceptInviteCallable({ token });
    return result.data;
  } catch (error: any) {
    console.error('Error accepting invitation via Cloud Function:', error);
    throw new Error(error.message || 'Failed to accept invitation.');
  }
};
