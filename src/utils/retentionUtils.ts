/*
 * FILE: src/utils/retentionUtils.ts
 * PURPOSE: Logic helper module to calculate billing cycle timelines and purge historical logs
 *          to keep Firestore usage within free limits.
 * WHERE USED: Called inside useDashboardData.ts whenever a household transitions or mounts.
 */

// Import Firestore queries, collection hooks, batch commiters, and timestamp formats
import { collection, getDocs, writeBatch, query, where, Timestamp } from 'firebase/firestore';
// Import db credentials configurations
import { db } from '../firebaseConfig';
// Import sync time resolvers
import { getSyncedDate } from './timeUtils';

/**
 * Calculates the start Date of the active billing cycle based on the current calendar date.
 */
export const getCycleStartDate = (baseDate: Date, startDay: number): Date => {
  // Duplicate check date
  const date = new Date(baseDate);
  // Reset hours/minutes/seconds parameters to midnight
  date.setHours(0, 0, 0, 0);
  
  // Calculate total days inside checking month to avoid indexing overflows
  const maxDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  // Set day threshold bounds
  const actualStartDay = Math.min(startDay, maxDays);
  
  // If calendar date has not reached startDay day of the month yet
  if (date.getDate() < actualStartDay) {
    // Decr target month by 1 (move back to prior billing cycle month context)
    date.setMonth(date.getMonth() - 1);
  }
  
  // Calculate max days inside the target month
  const targetMaxDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  // Set day offset bounds
  date.setDate(Math.min(startDay, targetMaxDays));
  return date;
};

/**
 * Queries and deletes chores, groceries, and expenses documents created older than
 * 4 cycles ago in a single atomic transaction batch.
 */
export const enforceDataRetentionPolicy = async (householdId: string, startDay: number) => {
  if (!householdId) return;
  try {
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, startDay);
    
    // Set retention window threshold: delete items created prior to 4 months/cycles ago
    const backupStartDate = new Date(currentCycleStart);
    backupStartDate.setMonth(backupStartDate.getMonth() - 4);
    
    console.log(`[Retention] Enforcing retention policy. Deletion threshold: ${backupStartDate.toDateString()}`);
    
    // Clean target subcollections list
    const collectionsToClean = ['expenses', 'chores', 'groceries'];
    for (const colName of collectionsToClean) {
      const colRef = collection(db, 'households', householdId, colName);
      // Construct queries fetching old document models
      const q = query(colRef, where('createdAt', '<', Timestamp.fromDate(backupStartDate)));
      const snap = await getDocs(q);
      
      // Initialize atomic transaction batch writer
      const batch = writeBatch(db);
      let count = 0;
      
      // Mark matching records for deletion
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
      });
      
      // Commit deletions atomically if any records are queued
      if (count > 0) {
        await batch.commit();
        console.log(`[Retention] Deleted ${count} old items from ${colName}`);
      }
    }
  } catch (error) {
    console.error('[Retention] Error enforcing data retention:', error);
  }
};
