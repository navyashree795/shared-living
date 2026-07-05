/*
 * FILE: src/utils/timeUtils.ts
 * PURPOSE: Global network clock synchronizer. It pings third-party servers to find latency offsets,
 *          correcting phone time discrepancies to prevent database synchronization conflicts.
 * WHERE USED: Called inside RootNavigator (App.tsx) on startup, and by due chore and garbage countdown timers.
 */

// Global variable saving the millisecond latency time offset between the device and NTP servers
let timeOffset = 0;

/**
 * Pings external NTP/HTTP servers to measure current network time and calculate a local offset.
 */
export const syncTimeWithNetwork = async () => {
  // Capture request launch timestamp
  const start = Date.now();
  
  // 1. Try primary NTP provider: timeapi.io
  try {
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', {
      method: 'GET',
    });
    const data = await response.json();
    const end = Date.now();
    if (data && data.dateTime) {
      // Divide total round-trip duration by 2 to estimate one-way latency
      const latency = (end - start) / 2;
      // Convert response date time to UTC timestamp and add estimated latency offset
      const networkTime = new Date(data.dateTime + 'Z').getTime() + latency;
      // Calculate delta offset between network clock and local system clock
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via timeapi.io: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.log('[TimeSync] timeapi.io failed, trying worldtimeapi.org...');
  }

  // 2. Try secondary NTP provider fallback: worldtimeapi.org
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      method: 'GET',
    });
    const data = await response.json();
    const end = Date.now();
    if (data && data.datetime) {
      // Divide total round-trip duration by 2 to estimate latency
      const latency = (end - start) / 2;
      // Compute latency adjusted network time
      const networkTime = new Date(data.datetime).getTime() + latency;
      // Calculate delta offset between network and local clock
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via worldtimeapi.org: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.log('[TimeSync] worldtimeapi.org failed, trying Google HEAD fallback...');
  }

  // 3. Robust CDN HTTP HEAD request fallback (checks the Date header returned from google.com)
  try {
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
    });
    // Extract standard HTTP Date header details
    const dateHeader = response.headers.get('date');
    const end = Date.now();
    if (dateHeader) {
      // Divide total round-trip duration by 2 to estimate latency
      const latency = (end - start) / 2;
      // Convert header date text to numeric millisecond timestamp
      const networkTime = new Date(dateHeader).getTime() + latency;
      // Calculate offset delta
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via Google HEAD: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.warn('[TimeSync] All time sync strategies failed, using device time.', e);
  }
};

/**
 * Returns a new Date instance adjusted by the calculated network time offset.
 */
export const getSyncedDate = () => {
  // Add offset to local system clock timestamp
  return new Date(Date.now() + timeOffset);
};

/**
 * Calculates the next calendar occurrence date matching a target weekday and time string.
 */
export const getNextOccurrence = (dayStr: string, timeStr: string): Date => {
  // Map weekday abbreviations to indices
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const targetDayIndex = daysOfWeek.indexOf(dayStr);
  if (targetDayIndex === -1) return getSyncedDate();

  // Get current offset corrected time
  const now = getSyncedDate();
  
  let hours = 0;
  let minutes = 0;
  try {
    // Regex matching hour digit groups and AM/PM parameters
    const timeMatch = timeStr.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  } catch (e) {
    console.warn("Error parsing time in getNextOccurrence:", e);
  }

  // Create duplicate target date
  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);

  // Compute weekday index differential
  const currentDayIndex = now.getDay();
  let dayDiff = targetDayIndex - currentDayIndex;

  // If the weekday index is in the past, or targets today but the time has already passed
  if (dayDiff < 0 || (dayDiff === 0 && result.getTime() < now.getTime())) {
    // Shift target forward to next week (add 7 days)
    dayDiff += 7;
  }

  // Add weekday offset to target date
  result.setDate(result.getDate() + dayDiff);
  return result;
};
