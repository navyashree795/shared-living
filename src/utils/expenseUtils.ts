import { doc, collection, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Expense } from '../types';
import { logActivity } from './activityUtils';

export const detectCategory = (title: string): string => {
  const t = title.toLowerCase();
  
  if (t.includes('grocer') || t.includes('food') || t.includes('snack') || t.includes('zomato') || t.includes('swiggy') || t.includes('milk') || t.includes('eat')) {
    return 'Groceries & Food';
  }
  
  if (t.includes('wifi') || t.includes('internet') || t.includes('electric') || t.includes('power') || t.includes('water') || t.includes('bill') || t.includes('utilit')) {
    return 'Utilities';
  }
  
  if (t.includes('rent') || t.includes('house') || t.includes('maid') || t.includes('clean')) {
    return 'Housing';
  }
  
  if (t.includes('movie') || t.includes('party') || t.includes('fun') || t.includes('drink') || t.includes('alcohol') || t.includes('trip')) {
    return 'Entertainment';
  }
  
  if (t.includes('travel') || t.includes('cab') || t.includes('uber') || t.includes('ola') || t.includes('petrol') || t.includes('gas') || t.includes('transit')) {
    return 'Transportation';
  }

  return 'General';
};

export const getCategoryIcon = (category: string | undefined): any => {
  switch (category) {
    case 'Groceries & Food':
      return 'fastfood';
    case 'Utilities':
      return 'bolt';
    case 'Housing':
      return 'house';
    case 'Entertainment':
      return 'celebration';
    case 'Transportation':
      return 'directions-car';
    case 'General':
    default:
      return 'receipt-long';
  }
};

export const getYearMonthString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const checkAndDraftRecurringExpenses = async (hid: string, expenses: Expense[]): Promise<void> => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || !hid || expenses.length === 0) return;

  const now = new Date();
  const currentYM = getYearMonthString(now);

  // Filter out recurring master expenses
  const recurringMasters = expenses.filter(exp => exp.isRecurring && exp.type === 'expense');

  for (const master of recurringMasters) {
    const lastYM = master.lastDraftedMonth;
    if (!lastYM) continue;

    // Parse last year/month
    const [lastYear, lastMonth] = lastYM.split('-').map(Number);
    const [currYear, currMonth] = currentYM.split('-').map(Number);

    // Calculate months to draft
    const datesToDraft: Date[] = [];
    let y = lastYear;
    let m = lastMonth;

    while (true) {
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      // If the target month (y, m) is less than or equal to current month
      if (y < currYear || (y === currYear && m <= currMonth)) {
        // Draft for 1st of month (y, m-1)
        const draftDate = new Date(y, m - 1, 1, 12, 0, 0); // 12:00 PM to avoid timezone boundary issues
        datesToDraft.push(draftDate);
      } else {
        break;
      }
    }

    if (datesToDraft.length > 0) {
      // Draft each transaction
      for (const draftDate of datesToDraft) {
        const ymString = getYearMonthString(draftDate);
        const docId = `${master.id}-recurring-${ymString}`;
        try {
          await setDoc(doc(db, 'households', hid, 'expenses', docId), {
            type: 'expense',
            title: master.title,
            amount: master.amount,
            category: master.category || 'General',
            paidByUid: master.paidByUid,
            payerName: master.payerName,
            splitAmong: master.splitAmong,
            createdAt: Timestamp.fromDate(draftDate),
            isDrafted: true,
          });

          // Log activity for automated drafting
          await logActivity(
            hid,
            'expense_add',
            `${master.title} (Auto-recurring bill for ${draftDate.toLocaleString('default', { month: 'long', year: 'numeric' })})`,
            'System Bot',
            master.amount
          );
        } catch (err) {
          console.error("Failed to draft recurring expense:", err);
        }
      }

      // Update the master expense lastDraftedMonth to currentYM
      try {
        await updateDoc(doc(db, 'households', hid, 'expenses', master.id), {
          lastDraftedMonth: currentYM
        });
      } catch (err) {
        console.error("Failed to update master recurring expense:", err);
      }
    }
  }
};
