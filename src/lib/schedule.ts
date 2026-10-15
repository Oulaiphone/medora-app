import { addDays, at, dateKey, toMin } from './dates';
import type { DoseLog, Food, Medication } from './types';

export type SlotStatus = 'taken' | 'skipped' | 'missed' | 'due' | 'upcoming';

export interface DoseSlot {
  key: string; // medId|date|time
  med: Medication;
  date: string;
  time: string;
  status: SlotStatus;
  log?: DoseLog;
}

export const slotKey = (medId: string, date: string, time: string) => `${medId}|${date}|${time}`;

export function statusFor(date: string, time: string, log: DoseLog | undefined, now: Date): SlotStatus {
  if (log) return log.status;
  const today = dateKey(now);
  if (date < today) return 'missed';
  if (date > today) return 'upcoming';
  const diff = (now.getTime() - at(date, time).getTime()) / 60000;
  if (diff > 60) return 'missed';
  if (diff >= -30) return 'due';
  return 'upcoming';
}

export function dosesFor(meds: Medication[], logs: DoseLog[], date: string = dateKey(), now: Date = new Date()): DoseSlot[] {
  const byKey = new Map<string, DoseLog>();
  for (const l of logs) if (l.date === date) byKey.set(slotKey(l.medId, l.date, l.time), l);
  const out: DoseSlot[] = [];
  for (const med of meds) {
    if (!med.active || med.started > date) continue;
    for (const time of med.times) {
      const key = slotKey(med.id, date, time);
      const log = byKey.get(key);
      out.push({ key, med, date, time, log, status: statusFor(date, time, log, now) });
    }
  }
  return out.sort((a, b) => toMin(a.time) - toMin(b.time) || a.med.name.localeCompare(b.med.name));
}

export function nextOpen(slots: DoseSlot[]): DoseSlot | undefined {
  return slots.find((s) => s.status === 'due') ?? slots.find((s) => s.status === 'upcoming');
}

export function perDay(med: Medication): number {
  return Math.max(1, med.dose * med.times.length);
}

export function daysLeft(med: Medication): number | null {
  if (med.supply == null) return null;
  return Math.floor(med.supply / perDay(med));
}

export function refillDue(med: Medication): boolean {
  const d = daysLeft(med);
  return d !== null && d <= med.refillDays;
}

export function supplyText(med: Medication): string {
  const d = daysLeft(med);
  if (d === null) return 'Supply not tracked';
  if (d <= 0) return 'Out of supply';
  if (refillDue(med)) return `Refill soon · ${d} day${d === 1 ? '' : 's'} left`;
  return `${d} days remaining`;
}

export interface DayCell {
  date: string;
  statuses: SlotStatus[];
}

export function week(meds: Medication[], logs: DoseLog[], now: Date = new Date(), days = 7): DayCell[] {
  const out: DayCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dateKey(addDays(now, -i));
    out.push({ date: d, statuses: dosesFor(meds, logs, d, now).map((s) => s.status) });
  }
  return out;
}

export function adherence(meds: Medication[], logs: DoseLog[], now: Date = new Date(), days = 7): { taken: number; total: number } {
  let taken = 0;
  let total = 0;
  for (const cell of week(meds, logs, now, days)) {
    for (const s of cell.statuses) {
      if (s === 'upcoming' || s === 'due') continue;
      total++;
      if (s === 'taken') taken++;
    }
  }
  return { taken, total };
}

export const FOOD_LABEL: Record<Food, string> = {
  with: 'With food',
  after: 'After food',
  before: 'Before food',
  empty: 'Empty stomach',
  none: 'Any time',
};

export function unitWord(form: string, n: number): string {
  const f = (form || 'dose').toLowerCase();
  if (n === 1) return f;
  if (f.endsWith('s')) return f;
  return `${f}s`;
}

export function numberWord(n: number): string {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  if (n === 0.5) return 'half a';
  return Number.isInteger(n) && n < w.length ? w[n] : String(n);
}

/** "Take 1 tablet with water" style sentence for speech and reminders */
export function doseSentence(med: Medication): string {
  return `Take ${numberWord(med.dose)} ${unitWord(med.form, med.dose)}. ${med.instructions}`.trim();
}
