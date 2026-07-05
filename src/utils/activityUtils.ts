/*
 * FILE: src/utils/activityUtils.ts
 * PURPOSE: Global audit logger utility to track and display roommate activities (chores, expenses, shopping)
 *          as a chronological feed on the home screen.
 * WHERE USED: Called throughout screens, contexts, and hooks whenever data changes (e.g. marking chores done).
 */

// Import database connection and auth reference
import { db, auth } from '../firebaseConfig';
// Import Firestore subcollection writers
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityType = 
  | 'grocery_add' 
  | 'grocery_done' 
  | 'expense_add' 
  | 'payment_add' 
  | 'chore_add' 
  | 'chore_done'
  | 'chore_reminder'
  | 'chore_rotate';

/**
 * Creates and writes an activity document into Firestore under the household subcollection.
 */
export const logActivity = async (
  householdId: string | undefined, 
  type: ActivityType, 
  title: string, 
  userName?: string,
  amount: number = 0,
  targetUid?: string
) => {
  // Return early if no household ID is active or if user is unauthenticated
  if (!householdId || !auth.currentUser) return;

  try {
    // Resolve triggering member name (defaults to email prefix)
    const finalUserName = userName || auth.currentUser.email?.split('@')[0] || 'Member';

    // Insert audit log document into activities subcollection
    await addDoc(collection(db, 'households', householdId, 'activities'), {
      type,
      title,
      userName: finalUserName,
      amount,
      userId: auth.currentUser.uid,
      targetUid: targetUid || null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Error logging activity:", e);
  }
};

interface ActivityConfig {
  icon: "shopping-basket" | "check-circle" | "receipt" | "done-all" | "add-task" | "task-alt" | "info" | "notifications-active" | "loop";
  color: string;
  label: string;
}

/**
 * Resolves activity types to design system configs (icons, colors, past-tense verb text labels).
 */
export const getActivityConfig = (type: string): ActivityConfig => {
  switch (type) {
    // Shopping list additions
    case 'grocery_add':
      return { icon: 'shopping-basket', color: '#059669', label: 'added to list' };
    // Purchased grocery items
    case 'grocery_done':
      return { icon: 'check-circle', color: '#10B981', label: 'bought' };
    // Shared bills logs
    case 'expense_add':
      return { icon: 'receipt', color: '#4F46E5', label: 'logged' };
    // repayer settlements payments
    case 'payment_add':
      return { icon: 'done-all', color: '#7C3AED', label: 'settled with' };
    // Created tasks assignations
    case 'chore_add':
      return { icon: 'add-task', color: '#CA8A04', label: 'assigned' };
    // Task completions
    case 'chore_done':
      return { icon: 'task-alt', color: '#059669', label: 'finished' };
    // Auto-scheduled chore alarms
    case 'chore_reminder':
      return { icon: 'notifications-active', color: '#D97706', label: 'reminded for' };
    // Turn rotation updates
    case 'chore_rotate':
      return { icon: 'loop', color: '#3B82F6', label: 'rotated turn for' };
    // Fallback info logs
    default:
      return { icon: 'info', color: '#6B7280', label: 'updated' };
  }
};
