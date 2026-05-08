let timeOffset = 0;

export const syncTimeWithNetwork = async () => {
  const start = Date.now();
  
  // 1. Try timeapi.io
  try {
    const response = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC', {
      method: 'GET',
    });
    const data = await response.json();
    const end = Date.now();
    if (data && data.dateTime) {
      const latency = (end - start) / 2;
      const networkTime = new Date(data.dateTime + 'Z').getTime() + latency;
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via timeapi.io: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.log('[TimeSync] timeapi.io failed, trying worldtimeapi.org...');
  }

  // 2. Try worldtimeapi.org as fallback
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      method: 'GET',
    });
    const data = await response.json();
    const end = Date.now();
    if (data && data.datetime) {
      const latency = (end - start) / 2;
      const networkTime = new Date(data.datetime).getTime() + latency;
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via worldtimeapi.org: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.log('[TimeSync] worldtimeapi.org failed, trying Google HEAD fallback...');
  }

  // 3. Robust CDN HEAD request fallback
  try {
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
    });
    const dateHeader = response.headers.get('date');
    const end = Date.now();
    if (dateHeader) {
      const latency = (end - start) / 2;
      const networkTime = new Date(dateHeader).getTime() + latency;
      timeOffset = networkTime - end;
      console.log(`[TimeSync] Offset calculated via Google HEAD: ${timeOffset}ms`);
      return;
    }
  } catch (e) {
    console.warn('[TimeSync] All time sync strategies failed, using device time.', e);
  }
};

export const getSyncedDate = () => {
  return new Date(Date.now() + timeOffset);
};
