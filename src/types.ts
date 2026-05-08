import { Timestamp } from 'firebase/firestore';

export type RootStackParamList = {
  Login: undefined;
  HouseholdSelection: undefined;
  HouseholdSetup: { householdId?: string | null; activeTab?: 'create' | 'join'; code?: string };
  MainTabs: undefined;
  Profile: undefined;
  // Tab screens — householdId comes from HouseholdContext, not params
  Dashboard: undefined;
  Grocery: undefined;
  Expenses: undefined;
  Chores: undefined;
  Chat: undefined;
};


export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  phoneNumber?: string;
  householdId: string | null;
  createdAt: string;
}

export interface HouseholdDetailField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'password' | 'time' | 'phone' | 'link';
  icon: string;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  members: string[];
  info?: {
    wifiName?: string;
    wifiPass?: string;
    trashArrivalTime?: string; // HH:mm format
    landlordName?: string;
    landlordPhone?: string;
    other?: string;
    details?: HouseholdDetailField[];
  };
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
  category?: string;
  paidByUid?: string;
  payerName?: string;
  splitAmong?: string[];
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
  expenseLogged?: boolean;
  createdAt: Timestamp;
}

export interface Chore {
  id: string;
  title: string;
  assignedToUid: string;
  done: boolean;
  createdByUid: string;
  time: string;
  day: string;
  createdAt: Timestamp;
  rotationEnabled?: boolean;
  rotationOrder?: string[];
  currentRotationIndex?: number;
  reminderSent?: boolean;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
  readBy?: string[];
}
