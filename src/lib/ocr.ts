import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Reads the text on a photo of a medicine label with the OCR.space API.
 * Get a free key at https://ocr.space/ocrapi and set EXPO_PUBLIC_OCR_SPACE_KEY in .env.
 * Without a key it falls back to OCR.space's public demo key, which is rate-limited.
 */
export const OCR_KEY = process.env.EXPO_PUBLIC_OCR_SPACE_KEY || 'helloworld';
export const usingDemoOcrKey = !process.env.EXPO_PUBLIC_OCR_SPACE_KEY;

export async function readLabel(uri: string): Promise<string> {
  // keep the upload small: the free tier accepts images up to 1 MB
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1400 }).renderAsync();
  const img = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!img.base64) throw new Error('Could not prepare the photo.');

  const body = new FormData();
  body.append('apikey', OCR_KEY);
  body.append('base64Image', `data:image/jpeg;base64,${img.base64}`);
  body.append('language', 'eng');
  body.append('OCREngine', '2');
  body.append('scale', 'true');
  body.append('detectOrientation', 'true');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Text reader returned ${res.status}. Try again in a minute.`);
    const json = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ParsedResults?: { ParsedText?: string }[];
    };
    if (json.IsErroredOnProcessing) {
      const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(' ') : json.ErrorMessage;
      throw new Error(msg || 'The text reader could not read this photo.');
    }
    const text = (json.ParsedResults ?? []).map((r) => r.ParsedText ?? '').join('\n').trim();
    if (!text) throw new Error('No text found. Try again closer, with good light, and the label flat.');
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The text reader took too long. Check your connection and try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
