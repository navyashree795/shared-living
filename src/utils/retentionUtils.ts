import { collection, getDocs, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getSyncedDate } from './timeUtils';

export const getCycleStartDate = (baseDate: Date, startDay: number): Date => {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  
  const maxDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const actualStartDay = Math.min(startDay, maxDays);
  
  if (date.getDate() < actualStartDay) {
    date.setMonth(date.getMonth() - 1);
  }
  
  const targetMaxDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(startDay, targetMaxDays));
  return date;
};

export const enforceDataRetentionPolicy = async (householdId: string, startDay: number) => {
  if (!householdId) return;
  try {
    const now = getSyncedDate();
    const currentCycleStart = getCycleStartDate(now, startDay);
    
    // Backup starts 4 months before current cycle start (covering months 4 & 5)
    // Deletion threshold is before backup starts (older than 5 months)
    const backupStartDate = new Date(currentCycleStart);
    backupStartDate.setMonth(backupStartDate.getMonth() - 4);
    
    console.log(`[Retention] Enforcing retention policy. Deletion threshold: ${backupStartDate.toDateString()}`);
    
    const collectionsToClean = ['expenses', 'chores', 'groceries'];
    for (const colName of collectionsToClean) {
      const colRef = collection(db, 'households', householdId, colName);
      const q = query(colRef, where('createdAt', '<', Timestamp.fromDate(backupStartDate)));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      let count = 0;
      
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`[Retention] Deleted ${count} old items from ${colName}`);
      }
    }
  } catch (error) {
    console.error('[Retention] Error enforcing data retention:', error);
  }
};
