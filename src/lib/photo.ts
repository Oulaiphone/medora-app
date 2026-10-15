import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** A small JPEG (as a data URI) that is light enough to keep on the phone and print. */
export async function makeThumb(uri: string): Promise<string | undefined> {
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: 360 }).renderAsync();
    const img = await ref.saveAsync({ compress: 0.5, format: SaveFormat.JPEG, base64: true });
    return img.base64 ? `data:image/jpeg;base64,${img.base64}` : undefined;
  } catch {
    return undefined;
  }
}

/** Takes or picks a photo and returns it as a thumbnail. Null if cancelled; throws with a friendly message. */
export async function pickPhoto(from: 'camera' | 'library'): Promise<string | null> {
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('MedOra needs camera access. You can allow it in your phone settings.');
  }
  const res =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (res.canceled || !res.assets[0]) return null;
  const thumb = await makeThumb(res.assets[0].uri);
  if (!thumb) throw new Error('Could not use that photo. Try another one.');
  return thumb;
}
