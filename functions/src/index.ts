import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

admin.initializeApp();
const db = admin.firestore();

/**
 * HTTP Callable Function: processReceiptImage
 *
 * Called directly from the React Native frontend.
 * Accepts a base64 receipt image, runs Gemini AI server-side,
 * splits the bill among household members, saves to Firestore,
 * and returns the extracted title + amount.
 *
 * Deploy with: firebase deploy --only functions
 * API Key:     firebase functions:config:set gemini.key="YOUR_KEY"
 */
export const processReceiptImage = functions.https.onCall(async (data, context) => {
  // ── 1. Auth Guard ─────────────────────────────────────────────
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }

  const { base64, mimeType, householdId, uploaderUid, uploaderName, allMemberUids, receiptUrl } = data;

  if (!base64 || !householdId || !uploaderUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  // ── 2. Load Gemini API Key (server-side only, never exposed to client) ─
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Gemini API key not configured. Add GEMINI_API_KEY to functions/.env'
    );
  }

  // ── 3. Run Gemini AI Extraction ───────────────────────────────
  let extractedTitle = 'Scanned Bill';
  let extractedAmount = 0;

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a receipt scanner. Look at this bill image.
Reply with ONLY a raw JSON object — no markdown, no backticks.
Format: {"title":"short bill description","amount":123.45}
- title: 2-4 words describing the bill (e.g. "Water Bill", "Grocery Shopping")
- amount: the TOTAL/NET AMOUNT DUE as a plain number only`;

    const aiResult = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: mimeType || 'image/jpeg' } },
    ]);

    const raw = aiResult.response.text().trim();
    console.log('[Backend] Gemini raw response:', raw);

    // Strip markdown fences if present
    const cleanJson = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title) extractedTitle = String(parsed.title);
      const num = parseFloat(String(parsed.amount ?? '0'));
      if (!isNaN(num) && num > 0) extractedAmount = num;
    }

    console.log(`[Backend] Extracted: "${extractedTitle}", ₹${extractedAmount}`);
  } catch (aiErr: any) {
    console.error('[Backend] Gemini error:', aiErr?.message);
    // Don't throw — return needsManualAmount so the UI can prompt the user
    return { success: false, needsManualAmount: true, title: extractedTitle, receiptUrl };
  }

  // ── 4. If Gemini couldn't extract amount, tell the client ─────
  if (extractedAmount <= 0) {
    return { success: false, needsManualAmount: true, title: extractedTitle, receiptUrl };
  }

  // ── 5. Get household members & split the bill ─────────────────
  const splitAmong: string[] =
    allMemberUids && allMemberUids.length > 0 ? allMemberUids : [uploaderUid];
  const sharePerPerson = +(extractedAmount / splitAmong.length).toFixed(2);

  // ── 6. Save expense to Firestore ──────────────────────────────
  await db.collection('households').doc(householdId).collection('expenses').add({
    type: 'expense',
    title: `[Auto] ${extractedTitle}`,
    amount: extractedAmount,
    category: 'General',
    paidByUid: uploaderUid,
    payerName: uploaderName,
    splitAmong,
    receiptUrl: receiptUrl || null,
    scannedByAI: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── 7. Log Activity ───────────────────────────────────────────
  await db.collection('households').doc(householdId).collection('activity').add({
    type: 'expense_add',
    description: `${extractedTitle} • ₹${sharePerPerson} each`,
    performedBy: uploaderName,
    amount: extractedAmount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[Backend] ✅ Done: ₹${extractedAmount} split among ${splitAmong.length} members.`);

  // ── 8. Return result to frontend ──────────────────────────────
  return {
    success: true,
    title: extractedTitle,
    amount: extractedAmount,
    receiptUrl: receiptUrl || null,
  };
});
