import type { Food } from './types';

export interface ParsedLabel {
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
  refills: string;
  asNeeded: boolean;
  confidence: { name: boolean; strength: boolean; schedule: boolean };
}

const STOP = /\b(RX|PHARMACY|PHARM|QTY|QUANTITY|REFILLS?|DR\.?|PRESCRIBER|DATE|FILLED|DISCARD|EXP|PATIENT|FOR|TAKE|USE|APPLY|INHALE|NDC|MFG|CAUTION|WARNING|DO NOT|STORE|KEEP|ORIGINAL|CLINIC|PHONE|TEL|ADDRESS|ST\b|AVE\b|ROAD|RD\b)\b/i;
const FORMS: [RegExp, string][] = [
  [/\b(TABS?|TABLETS?|TBL|TBS)\b/i, 'tablet'],
  [/\b(CAPS?|CAPSULES?)\b/i, 'capsule'],
  [/\bSOFT ?GELS?\b/i, 'softgel'],
  [/\b(INHALER|PUFFS?|INHALATION)\b/i, 'puff'],
  [/\b(DROPS?)\b/i, 'drop'],
  [/\b(PATCH(ES)?)\b/i, 'patch'],
  [/\b(ML|LIQUID|SOLUTION|SUSPENSION|SYRUP)\b/i, 'ml'],
];
const WORDNUM: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, HALF: 0.5, '1/2': 0.5 };

const title = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

export function parseLabel(raw: string): ParsedLabel {
  const lines = cleanLines(raw);
  const all = lines.join(' \n ');
  const up = all.toUpperCase();

  // strength, e.g. "25 MCG", "500mg", "1,000 IU", "0.5 MG"
  const strRe = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(MG|MCG|µG|UG|G|ML|IU|UNITS?|%)\b/i;
  const sm = all.match(strRe);
  let strength = '';
  if (sm) {
    const unit = sm[2].toUpperCase().replace('µG', 'MCG').replace('UG', 'MCG');
    const u = unit === 'UNITS' || unit === 'UNIT' ? 'units' : unit === 'IU' ? 'IU' : unit === '%' ? '%' : unit.toLowerCase();
    strength = `${sm[1]} ${u}`.replace(' %', '%');
  }

  // name: words just before the strength on the same line, else first plausible line
  let name = '';
  const strLine = sm ? lines.find((l) => strRe.test(l)) : undefined;
  if (strLine) {
    const before = strLine.slice(0, strLine.search(strRe)).replace(/[^A-Za-z0-9\-\s]/g, ' ').trim();
    const words = before.split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && (w.length > 1 || /\d/.test(w)) && !STOP.test(w));
    if (words.length) name = words.slice(-2).join(' ');
  }
  if (!name) {
    const cand = lines.find((l) => /^[A-Za-z][A-Za-z\- ]{2,30}$/.test(l) && !STOP.test(l));
    if (cand) name = cand;
  }
  name = title(name.replace(/\b(TABS?|TABLETS?|CAPS?|CAPSULES?|HCL|ER|XR|SR)\b/gi, '').trim());

  let form = 'tablet';
  for (const [re, f] of FORMS) {
    if (re.test(up)) {
      form = f;
      break;
    }
  }

  // dose per intake: "TAKE 1 TABLET", "TAKE TWO CAPSULES", "INHALE 2 PUFFS"
  let dose = 1;
  const dm = up.match(/\b(?:TAKE|INHALE|USE|APPLY|GIVE|INSTILL)\s+(\d+(?:\.\d+)?|ONE|TWO|THREE|FOUR|HALF|1\/2)\b/);
  if (dm) dose = WORDNUM[dm[1]] ?? Number(dm[1]);

  // frequency + times
  const explicit: string[] = [];
  const tre = /\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tre.exec(all))) {
    let h = Number(tm[1]) % 12;
    if (/P/i.test(tm[3])) h += 12;
    const m = tm[2] ? Number(tm[2]) : 0;
    if (h < 24 && m < 60) explicit.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  let perDay = 0;
  if (/\b(FOUR TIMES|4 TIMES|QID|EVERY 6 HOURS|Q6H)\b/.test(up)) perDay = 4;
  else if (/\b(THREE TIMES|3 TIMES|TID|EVERY 8 HOURS|Q8H)\b/.test(up)) perDay = 3;
  else if (/\b(TWICE|TWO TIMES|2 TIMES|BID|EVERY 12 HOURS|Q12H|MORNING AND (EVENING|NIGHT|BEDTIME))\b/.test(up)) perDay = 2;
  else if (/\b(ONCE|ONE TIME|1 TIME|DAILY|EVERY DAY|EACH DAY|A DAY|QD|EVERY MORNING|EVERY EVENING|AT BEDTIME|NIGHTLY|EVERY NIGHT|QHS)\b/.test(up)) perDay = 1;

  let times: string[];
  if (explicit.length) times = Array.from(new Set(explicit)).sort();
  else if (perDay === 1 && /\b(BEDTIME|NIGHTLY|EVERY NIGHT|QHS|AT NIGHT)\b/.test(up)) times = ['21:00'];
  else if (perDay === 1 && /\b(EVENING|DINNER|SUPPER)\b/.test(up)) times = ['19:00'];
  else if (perDay === 1 && /\b(LUNCH|NOON|AFTERNOON)\b/.test(up)) times = ['13:00'];
  else if (perDay === 2) times = ['08:00', '20:00'];
  else if (perDay === 3) times = ['08:00', '14:00', '20:00'];
  else if (perDay === 4) times = ['08:00', '12:00', '16:00', '20:00'];
  else times = ['08:00'];

  let food: Food = 'none';
  if (/\b(EMPTY STOMACH)\b/.test(up)) food = 'empty';
  else if (/\b(BEFORE (A )?MEALS?|BEFORE (FOOD|EATING|BREAKFAST))\b/.test(up)) food = 'before';
  else if (/\b(AFTER (A )?MEALS?|AFTER (FOOD|EATING|BREAKFAST|LUNCH|DINNER))\b/.test(up)) food = 'after';
  else if (/\b(WITH (A )?(FOOD|MEALS?|BREAKFAST|LUNCH|DINNER|MILK))\b/.test(up)) food = 'with';

  // directions sentence, e.g. "Take 1 tablet by mouth once daily with food"
  let instructions = '';
  const dirIdx = lines.findIndex((l) => /^(TAKE|INHALE|USE|APPLY|GIVE|INSTILL)\b/i.test(l));
  if (dirIdx >= 0) {
    let s = lines[dirIdx];
    for (let i = dirIdx + 1; i < Math.min(lines.length, dirIdx + 3); i++) {
      if (STOP.test(lines[i]) && !/\b(BY MOUTH|DAILY|TIMES|WITH|BEFORE|AFTER|HOURS?)\b/i.test(lines[i])) break;
      if (/^(#|QTY|QUANTITY|REFILL|DR\b|RX|DISCARD|EXP)/i.test(lines[i])) break;
      s += ` ${lines[i]}`;
    }
    instructions = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    instructions = instructions.replace(/\s+/g, ' ').replace(/\.$/, '').replace(/\b(a\.?m\.?|p\.?m\.?)(?=\s|$)/g, (x) => x.replace(/\./g, '').toUpperCase());
  }
  if (!instructions) {
    instructions =
      food === 'with' ? 'Take with food' : food === 'after' ? 'Take after food' : food === 'before' ? 'Take before food' : food === 'empty' ? 'Take on an empty stomach' : 'Take as directed';
  }

  const pm = all.match(/\b(?:PRESCRIBER\s*:?\s*)?(?:DR\.?|DOCTOR)\s+([A-Za-z][A-Za-z'\-]+(?:[ \t]+[A-Za-z][A-Za-z'\-]+)?)/i);
  const prescriber = pm ? `Dr. ${title(pm[1])}` : '';
  const phm = lines.find((l) => /PHARMACY|DRUG|CVS|WALGREENS|RITE AID|KROGER|WALMART/i.test(l));
  const pharmacy = phm ? title(phm.replace(/[^A-Za-z&'\-\s]/g, ' ').replace(/\s+/g, ' ').trim()).replace(/\bCvs\b/, 'CVS') : '';
  const qm = up.match(/(?:\bQTY|\bQUANTITY|#)\s*:?\s*(\d{1,4})\b/);
  const rm = up.match(/\bREFILLS?\s*:?\s*(\d+|NO|NONE|ZERO)\b/);

  return {
    name,
    strength,
    form,
    dose,
    times,
    instructions,
    food,
    prescriber,
    pharmacy,
    supply: qm ? Number(qm[1]) : null,
    refills: rm ? (/\d/.test(rm[1]) ? rm[1] : '0') : '',
    asNeeded: /\b(AS NEEDED|PRN|IF NEEDED)\b/.test(up),
    confidence: { name: !!name, strength: !!strength, schedule: perDay > 0 || explicit.length > 0 },
  };
}

/** A canned label so scanning can be shown without a camera or network. */
export const SAMPLE_LABEL_TEXT = `OAKWOOD HEALTH PHARMACY
RX# 40812   DATE FILLED 10/14
MARGARET WILSON
RESPIRA-LITE 25 MCG TABLETS
TAKE 1 TABLET BY MOUTH ONCE DAILY
AT 8:30 AM WITH WATER
QTY: 30   REFILLS: 2
DR. ELENA CHEN`;
