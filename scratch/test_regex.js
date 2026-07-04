const url1 = "sharedliving://invite/abc-123_xyz";
const url2 = "https://shared-living-app.web.app/invite/abc-123_xyz";
const url3 = "sharedliving://invite/abc-123_xyz?utm_source=test";
const url4 = "sharedliving://invite/abc-123_xyz/";

const extractToken = (urlStr) => {
  try {
    const match = urlStr.match(/\/invite\/([a-zA-Z0-9_\-]+)/);
    return match ? match[1] : null;
  } catch (e) {
    console.error("Error parsing invite URL:", e);
    return null;
  }
};

console.log("url1:", extractToken(url1));
console.log("url2:", extractToken(url2));
console.log("url3:", extractToken(url3));
console.log("url4:", extractToken(url4));
