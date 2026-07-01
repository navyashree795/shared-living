import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();

const db = admin.firestore();

export const ping = functions.https.onRequest((req, res) => {
  res.send("pong");
});

// 1. Create an invitation token
export const createInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { householdId } = data;
  if (!householdId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a householdId.');
  }

  const uid = context.auth.uid;

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }

    const userData = userDoc.data();
    if (userData?.householdId !== householdId) {
      throw new functions.https.HttpsError('permission-denied', 'You do not belong to this household.');
    }

    const householdDoc = await db.collection('households').doc(householdId).get();
    if (!householdDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Household not found.');
    }

    const token = crypto.randomBytes(16).toString('hex');

    const invitationData = {
      token,
      householdId,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      status: 'pending',
      usedBy: null,
      usedAt: null
    };

    await db.collection('invitations').doc(token).set(invitationData);

    return { token };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create invitation.');
  }
});

// 2. Validate invitation token
export const validateInvitation = functions.https.onCall(async (data, context) => {
  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'Invitation token is required.');
  }

  try {
    const inviteDoc = await db.collection('invitations').doc(token).get();
    if (!inviteDoc.exists) {
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
      await inviteDoc.ref.update({ status: 'expired' });
      return { valid: false, message: 'This invitation has expired.' };
    }

    const householdDoc = await db.collection('households').doc(inviteData.householdId).get();
    if (!householdDoc.exists) {
      return { valid: false, message: 'Household no longer exists.' };
    }

    const householdData = householdDoc.data();

    return {
      valid: true,
      householdId: inviteData.householdId,
      householdName: householdData?.name || 'Shared Space'
    };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message || 'Failed to validate invitation.');
  }
});

// 3. Accept invitation and join household
export const acceptInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'Invitation token is required.');
  }

  const uid = context.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const inviteRef = db.collection('invitations').doc(token);
      const inviteDoc = await transaction.get(inviteRef);

      if (!inviteDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Invalid invitation.');
      }

      const inviteData = inviteDoc.data();
      if (!inviteData) {
        throw new functions.https.HttpsError('internal', 'Invitation data is empty.');
      }

      if (inviteData.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation has already been used.');
      }

      const expiresAt = inviteData.expiresAt.toDate();
      if (expiresAt < new Date()) {
        transaction.update(inviteRef, { status: 'expired' });
        throw new functions.https.HttpsError('failed-precondition', 'Invitation has expired.');
      }

      const householdRef = db.collection('households').doc(inviteData.householdId);
      const householdDoc = await transaction.get(householdRef);

      if (!householdDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Household no longer exists.');
      }

      const householdData = householdDoc.data();
      const members = householdData?.members || [];

      if (members.includes(uid)) {
        return { success: true, alreadyMember: true, householdId: inviteData.householdId };
      }

      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const oldHouseholdId = userDoc.data()?.householdId;
      if (oldHouseholdId && oldHouseholdId !== inviteData.householdId) {
        const oldHouseholdRef = db.collection('households').doc(oldHouseholdId);
        const oldHouseholdDoc = await transaction.get(oldHouseholdRef);
        if (oldHouseholdDoc.exists) {
          const oldMembers = oldHouseholdDoc.data()?.members || [];
          const updatedOldMembers = oldMembers.filter((m: string) => m !== uid);
          transaction.update(oldHouseholdRef, { members: updatedOldMembers });
        }
      }

      transaction.update(inviteRef, {
        status: 'accepted',
        usedBy: uid,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(householdRef, {
        members: admin.firestore.FieldValue.arrayUnion(uid)
      });

      transaction.update(userRef, {
        householdId: inviteData.householdId
      });

      return { success: true, householdId: inviteData.householdId };
    });

    return result;
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'Failed to accept invitation.');
  }
});

// 4. Automatically delete expired travel households and reset members
export const cleanupExpiredHouseholds = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = new Date().toISOString();
  try {
    const expiredHouseholdsSnap = await db.collection('households')
      .where('type', '==', 'travel')
      .where('expiresAt', '<=', now)
      .get();

    if (expiredHouseholdsSnap.empty) {
      console.log('No expired travel households found.');
      return null;
    }

    console.log(`Found ${expiredHouseholdsSnap.size} expired travel households. Starting cleanup.`);

    for (const householdDoc of expiredHouseholdsSnap.docs) {
      const data = householdDoc.data();
      const members = data.members || [];
      const householdId = householdDoc.id;

      // A. Reset householdId for all members
      if (members.length > 0) {
        const batch = db.batch();
        members.forEach((uid: string) => {
          const userRef = db.collection('users').doc(uid);
          batch.update(userRef, { householdId: null });
        });
        await batch.commit();
        console.log(`Reset householdId for members of household ${householdId}`);
      }

      // B. Recursively delete the household document and all of its subcollections
      await db.recursiveDelete(householdDoc.ref);
      console.log(`Recursively deleted household document and subcollections for ${householdId}`);
    }

    console.log('Successfully completed cleanup of all expired households.');
    return null;
  } catch (err: any) {
    console.error('Error during expired households cleanup:', err);
    return null;
  }
});
