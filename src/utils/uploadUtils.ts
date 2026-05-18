import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logActivity } from './activityUtils';
import { detectCategory } from './expenseUtils';

export interface ScanResult {
  success: boolean;
  title?: string;
  amount?: number;
  receiptUrl?: string;
  needsManualAmount?: boolean;
  error?: string;
}

// Upload image to ImgBB (free, no credit card needed)
const uploadToImgBB = async (base64: string): Promise<string | null> => {
  const apiKey = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
  if (!apiKey) {
    console.warn('[Receipt] No ImgBB API key. Add EXPO_PUBLIC_IMGBB_API_KEY to .env');
    return null;
  }
  try {
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64);
    const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const json = await response.json();
    if (json.success) {
      console.log('[Receipt] ImgBB upload success:', json.data.display_url);
      return json.data.display_url as string;
    }
    console.error('[Receipt] ImgBB upload failed:', json);
    return null;
  } catch (e: any) {
    console.error('[Receipt] ImgBB error:', e?.message);
    return null;
  }
};

export const pickAndUploadReceipt = async (
  householdId: string,
  uploaderUid: string,
  uploaderName: string,
  allMemberUids: string[]
): Promise<ScanResult> => {

  // ── STEP 1: Pick image ───────────────────────────────────────
  let asset: ImagePicker.ImagePickerAsset;
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return { success: false };
    asset = result.assets[0];
    console.log('[Receipt] Image picked successfully');
  } catch (e: any) {
    console.error('[Receipt] Image pick failed:', e?.message);
    return { success: false, error: 'image_pick' };
  }

  // ── STEP 2: Upload to ImgBB for a public receipt URL ────────
  let receiptUrl = '';
  if (asset.base64) {
    console.log('[Receipt] Uploading to ImgBB...');
    const url = await uploadToImgBB(asset.base64);
    if (url) receiptUrl = url;
  }

  // ── STEP 3: AI Extraction with Gemini ───────────────────────
  let extractedTitle = 'Scanned Bill';
  let extractedAmount = 0;

  const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  console.log('[Receipt] Gemini key present:', !!geminiApiKey);

  if (geminiApiKey && asset.base64) {
    try {
      // Using gemini-1.5-flash: the stable high-performance model.
      // It is the recommended workhorse for multimodal tasks like receipt scanning.
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are a receipt scanner. Look at this bill image.
Reply with ONLY a raw JSON object — no markdown, no backticks.
Format: {"title":"short bill description","amount":123.45}
- title: 2-4 words describing the bill (e.g. "Water Bill", "Grocery Shopping")
- amount: the TOTAL/NET AMOUNT DUE as a plain number only`;

      const aiResult = await model.generateContent([
        prompt,
        { inlineData: { data: asset.base64, mimeType: 'image/jpeg' } },
      ]);

      const raw = aiResult.response.text().trim();
      console.log('[Receipt] Gemini response:', raw);

      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) extractedTitle = String(parsed.title);
        const num = parseFloat(String(parsed.amount ?? '0'));
        if (!isNaN(num) && num > 0) extractedAmount = num;
      }
      console.log('[Receipt] Extracted:', extractedTitle, '₹', extractedAmount);
    } catch (aiErr: any) {
      console.error('[Receipt] Gemini failed:', aiErr?.message);
    }
  }

  // ── STEP 4: If AI couldn't read amount, let user enter manually ──
  if (extractedAmount <= 0) {
    console.warn('[Receipt] Amount not extracted. Returning for manual entry.');
    return { success: false, needsManualAmount: true, receiptUrl, title: extractedTitle };
  }

  // ── STEP 5: Save to Firestore with split ────────────────────
  const splitAmong = allMemberUids.length > 0 ? allMemberUids : [uploaderUid];
  const sharePerPerson = +(extractedAmount / splitAmong.length).toFixed(2);

  await addDoc(collection(db, 'households', householdId, 'expenses'), {
    type: 'expense',
    title: `[Auto] ${extractedTitle}`,
    amount: extractedAmount,
    category: detectCategory(extractedTitle),
    paidByUid: uploaderUid,
    payerName: uploaderName,
    splitAmong,
    receiptUrl: receiptUrl || null,
    scannedByAI: true,
    createdAt: serverTimestamp(),
  });

  // ── STEP 6: Notify all members via activity log ─────────────
  await logActivity(
    householdId,
    'expense_add',
    `${extractedTitle} • ₹${sharePerPerson} each`,
    uploaderName,
    extractedAmount
  );

  console.log('[Receipt] All done!');
  return { success: true, title: extractedTitle, amount: extractedAmount, receiptUrl };
};

export const saveManualReceiptExpense = async (
  householdId: string,
  uploaderUid: string,
  uploaderName: string,
  allMemberUids: string[],
  title: string,
  amount: number,
  receiptUrl: string
): Promise<boolean> => {
  try {
    const splitAmong = allMemberUids.length > 0 ? allMemberUids : [uploaderUid];
    const sharePerPerson = +(amount / splitAmong.length).toFixed(2);
    await addDoc(collection(db, 'households', householdId, 'expenses'), {
      type: 'expense',
      title: `[Receipt] ${title}`,
      amount,
      category: detectCategory(title),
      paidByUid: uploaderUid,
      payerName: uploaderName,
      splitAmong,
      receiptUrl: receiptUrl || null,
      scannedByAI: false,
      createdAt: serverTimestamp(),
    });
    await logActivity(
      householdId,
      'expense_add',
      `${title} • ₹${sharePerPerson} each`,
      uploaderName,
      amount
    );
    return true;
  } catch (e) {
    console.error('[Receipt] Manual save error:', e);
    return false;
  }
};

export const pickAndUploadImageOnly = async (): Promise<string | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    const base64 = result.assets[0].base64;
    if (base64) {
      return await uploadToImgBB(base64);
    }
  } catch (e: any) {
    console.error('[Receipt] Image pick failed:', e?.message);
  }
  return null;
};
