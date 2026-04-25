let timeOffset = 0;

export const syncTimeWithNetwork = async () => {
  try {
    const start = Date.now();
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
      method: 'GET',
    });
    const data = await response.json();
    const end = Date.now();
    
    // Approximate latency
    const latency = (end - start) / 2;
    const networkTime = new Date(data.datetime).getTime() + latency;
    
    timeOffset = networkTime - end;
    console.log(`[TimeSync] Offset calculated: ${timeOffset}ms`);
  } catch (e) {
    console.warn('[TimeSync] Failed to sync time with network, using device time.', e);
  }
};

export const getSyncedDate = () => {
  return new Date(Date.now() + timeOffset);
};
