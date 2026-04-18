import { Timestamp } from 'firebase/firestore';

export type RootStackParamList = {
  Login: undefined;
  HouseholdSelection: undefined;
  HouseholdSetup: { householdId?: string | null; activeTab?: 'create' | 'join'; code?: string };
  Dashboard: { householdId: string; householdData?: Household };
  Grocery: { householdId: string; members: string[] };
  Expenses: { householdId: string; members: string[] };
  Chores: { householdId: string; members: string[] };
  Chat: { householdId: string; members: string[]; householdData?: Household };
};

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  phoneNumber?: string;
  householdId: string | null;
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  members: string[];
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  userName: string;
  amount: number;
  userId: string;
  createdAt: Timestamp;
}

export interface Expense {
  id: string;
  type: 'expense' | 'payment';
  title?: string;
  amount: number;
  paidByUid?: string;
  splitWith?: string[];
  perPerson?: number;
  fromPaidUid?: string;
  toReceivedUid?: string;
  createdAt: Timestamp;
}

export interface GroceryItem {
  id: string;
  name: string;
  done: boolean;
  category: string;
  qty: string;
  price: number;
  addedBy: string;
  createdAt: Timestamp;
}

export interface Chore {
  id: string;
  title: string;
  assignedToUid: string;
  done: boolean;
  createdByUid: string;
  startTime: string;
  endTime: string;
  day: string;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
  readBy?: string[];
}
