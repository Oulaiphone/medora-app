import * as Crypto from 'expo-crypto';

export const uid = (): string => Crypto.randomUUID();

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteCode(): string {
  const bytes = Crypto.getRandomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return s;
}
