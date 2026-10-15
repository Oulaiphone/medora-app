const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "08:00" -> minutes since midnight */
export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "19:00" -> "7:00 PM" */
export function label(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${ap}`;
}

export function at(dateK: string, t: string): Date {
  const d = parseKey(dateK);
  const [h, m] = t.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export type Slot = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export function slotOf(t: string): Slot {
  const m = toMin(t);
  if (m < 12 * 60) return 'Morning';
  if (m < 17 * 60) return 'Afternoon';
  if (m < 22 * 60) return 'Evening';
  return 'Night';
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Wednesday, 18 June" */
export function longDay(d: Date = new Date()): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
/** "18 Jun 2026" */
export function shortDate(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
export function weekdayShort(d: Date): string {
  return DAYS[d.getDay()].slice(0, 3);
}

/** "Just now", "12 min ago", "Today, 3:40 PM", "Yesterday, 1:12 PM", "15 Jun, 10:24 AM" */
export function ago(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = (now.getTime() - d.getTime()) / 60000;
  const time = label(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${Math.round(diff)} min ago`;
  if (dateKey(d) === dateKey(now)) return `Today, ${time}`;
  if (dateKey(d) === dateKey(addDays(now, -1))) return `Yesterday, ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${time}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function age(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const b = parseKey(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
