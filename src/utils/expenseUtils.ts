/*
 * FILE: src/utils/expenseUtils.ts
 * PURPOSE: Logic helper modules for split bill categorizations and auto-drafting recurring invoice templates.
 * WHERE USED: Used in ExpenseScreen.tsx and useDashboardData.ts to automatically guess categories from titles,
 *             load matching category icon tags, and generate active bills from recurring schedules.
 */

// Import Firestore document references and database connections
import { doc, collection, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
// Import auth modules and configurations
import { auth, db } from '../firebaseConfig';
// Import custom types schemas
import { Expense } from '../types';
// Import helper utilities
import { logActivity } from './activityUtils';

/**
 * Automatically detects the spending category based on keywords in the expense title.
 */
export const detectCategory = (title: string): string => {
  // Convert description to lowercase
  const t = title.toLowerCase();
  
  // Match food/grocery keywords
  if (t.includes('grocer') || t.includes('food') || t.includes('snack') || t.includes('zomato') || t.includes('swiggy') || t.includes('milk') || t.includes('eat')) {
    return 'Groceries & Food';
  }
  
  // Match utility keys (electricity, water, wifi)
  if (t.includes('wifi') || t.includes('internet') || t.includes('electric') || t.includes('power') || t.includes('water') || t.includes('bill') || t.includes('utilit')) {
    return 'Utilities';
  }
  
  // Match housing/maid keywords
  if (t.includes('rent') || t.includes('house') || t.includes('maid') || t.includes('clean')) {
    return 'Housing';
  }
  
  // Match entertainment/outings keys
  if (t.includes('movie') || t.includes('party') || t.includes('fun') || t.includes('drink') || t.includes('alcohol') || t.includes('trip')) {
    return 'Entertainment';
  }
  
  // Match transportation keywords
  if (t.includes('travel') || t.includes('cab') || t.includes('uber') || t.includes('ola') || t.includes('petrol') || t.includes('gas') || t.includes('transit')) {
    return 'Transportation';
  }

  // Fallback category
  return 'General';
};

/**
 * Maps category labels to Material Vector Icon names.
 */
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

/**
 * Returns a formatted "YYYY-MM" string representing the year and month of a Date.
 */
export const getYearMonthString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/**
 * Scans recurring bill templates and auto-drafts transactions for any months
 * that have elapsed since `lastDraftedMonth` up to the current date.
 */
export const checkAndDraftRecurringExpenses = async (hid: string, expenses: Expense[]): Promise<void> => {
  // Grab current logged in user unique id
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || !hid || expenses.length === 0) return;

  // Track current YYYY-MM
  const now = new Date();
  const currentYM = getYearMonthString(now);

  // Filter out recurring master templates
  const recurringMasters = expenses.filter(exp => exp.isRecurring && exp.type === 'expense');

  // Loop recurring master records
  for (const master of recurringMasters) {
    const lastYM = master.lastDraftedMonth;
    if (!lastYM) continue;

    // Parse year/month integers
    const [lastYear, lastMonth] = lastYM.split('-').map(Number);
    const [currYear, currMonth] = currentYM.split('-').map(Number);

    // List of months dates requiring drafts creations
    const datesToDraft: Date[] = [];
    let y = lastYear;
    let m = lastMonth;

    // Calculate months gaps dynamically
    while (true) {
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      // Check if target date falls in the past or matches current month
      if (y < currYear || (y === currYear && m <= currMonth)) {
        const draftDate = new Date(y, m - 1, 1, 12, 0, 0); // Center at noon to prevent offset shifts
        datesToDraft.push(draftDate);
      } else {
        break;
      }
    }

    if (datesToDraft.length > 0) {
      // Create a draft document for each pending date
      for (const draftDate of datesToDraft) {
        const ymString = getYearMonthString(draftDate);
        const docId = `${master.id}-recurring-${ymString}`;
        try {
          // Write the generated draft document to Firestore subcollection
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

          // Log the automated transaction to household activity logs
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

      // Update the master template's lastDraftedMonth parameter in Firestore
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
