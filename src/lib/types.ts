import type { Tone } from './theme';

export type Food = 'with' | 'after' | 'before' | 'empty' | 'none';
export type DoseStatus = 'taken' | 'skipped';

export interface HistoryItem {
  id: string;
  text: string;
  by: string;
  at: string; // ISO timestamp
}

export interface Medication {
  id: string;
  name: string;
  strength: string; // "10 mg"
  form: string; // "tablet", "capsule"
  dose: number; // units per intake
  times: string[]; // "HH:MM", 24h, sorted
  instructions: string; // "Take with breakfast"
  food: Food;
  prescriber: string;
  pharmacy?: string;
  purpose?: string;
  appearance?: string; // "Round · white · marked CV10"
  supply: number | null; // units on hand
  refillDays: number; // warn when this many days are left
  started: string; // YYYY-MM-DD
  document?: string; // "Scanned label · 18 Oct"
  remindOffset: 0 | 10 | 30; // minutes before
  personalNote?: string;
  tone: Tone;
  active: boolean;
  history: HistoryItem[];
  updatedAt: string;
}

export interface DoseLog {
  id: string;
  medId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM scheduled time
  status: DoseStatus;
  reason?: string;
  by: string;
  at: string; // ISO
}

export interface Activity {
  id: string;
  who: string;
  text: string;
  at: string; // ISO
}

export interface Provider {
  id: string;
  name: string;
  role: string;
  org: string;
}

export interface Profile {
  name: string;
  dob: string;
  phone: string;
  bloodGroup: string;
  allergies: string[];
  emergency: { name: string; relation: string; phone: string };
  providers: Provider[];
  pharmacy: string;
}

export interface Perms {
  meds: boolean; // view medicines & doses
  mark: boolean; // mark doses as taken
  alerts: boolean; // missed-dose alerts
  docs: boolean; // see documents
}

export interface Member {
  id: string; // user id (shared) or local id (sample)
  name: string;
  relation: string;
  contact?: string;
  perms: Perms;
  emergency?: boolean;
  tone: Tone;
  source: 'sample' | 'shared';
}

export interface Settings {
  onboarded: boolean;
  mode: 'personal' | 'demo';
  largeText: boolean;
  simpleHome: boolean;
  remindersOn: boolean;
  followUp: boolean;
  voiceLang: 'en-US' | 'es-ES' | 'zh-CN';
}

export interface CaringFor {
  circleId: string;
  patientName: string;
  myName: string;
}

export interface OutboxItem {
  id: string;
  table: 'medications' | 'dose_events' | 'activity' | 'circles';
  op: 'upsert' | 'delete';
  row: Record<string, unknown>;
}

export interface Sharing {
  circleId?: string;
  inviteCode?: string;
  outbox: OutboxItem[];
  lastSync?: string;
}

export interface ScanDraft {
  name: string;
  strength: string;
  form: string;
  dose: number;
  times: string[];
  instructions: string;
  food: Food;
  prescriber: string;
  pharmacy: string;
  supply: number | null;
  document: string;
  rawText: string;
  warnings: string[];
}
