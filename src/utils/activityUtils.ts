import { db, auth } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';

export type ActivityType = 
  | 'grocery_add' 
  | 'grocery_done' 
  | 'expense_add' 
  | 'payment_add' 
  | 'chore_add' 
  | 'chore_done';

export const logActivity = async (
  householdId: string | undefined, 
  type: ActivityType, 
  title: string, 
  amount: number = 0
) => {
  if (!householdId || !auth.currentUser) return;

  try {
    // Fetch current user's profile to get the most accurate name
    const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userSnap.exists() ? userSnap.data() : null;
    const userName = userData?.username ? `@${userData.username}` : (auth.currentUser.email?.split('@')[0] || 'Member');

    await addDoc(collection(db, 'households', householdId, 'activities'), {
      type,
      title,
      userName,
      amount,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Error logging activity:", e);
  }
};

interface ActivityConfig {
  icon: "shopping-basket" | "check-circle" | "receipt" | "done-all" | "add-task" | "task-alt" | "info";
  color: string;
  label: string;
}

export const getActivityConfig = (type: string): ActivityConfig => {
  switch (type) {
    case 'grocery_add':
      return { icon: 'shopping-basket', color: '#059669', label: 'added to list' };
    case 'grocery_done':
      return { icon: 'check-circle', color: '#10B981', label: 'bought' };
    case 'expense_add':
      return { icon: 'receipt', color: '#4F46E5', label: 'logged' };
    case 'payment_add':
      return { icon: 'done-all', color: '#7C3AED', label: 'settled with' };
    case 'chore_add':
      return { icon: 'add-task', color: '#CA8A04', label: 'assigned' };
    case 'chore_done':
      return { icon: 'task-alt', color: '#059669', label: 'finished' };
    default:
      return { icon: 'info', color: '#6B7280', label: 'updated' };
  }
};
