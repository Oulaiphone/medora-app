import { addDays, at, dateKey } from './dates';
import { uid } from './id';
import type { Activity, DoseLog, Medication, Member, Profile } from './types';

/** Fictional sample data (Margaret Wilson) so the app can be explored like the class prototype. */
export function sampleData(now: Date = new Date()) {
  const iso = (d: Date) => d.toISOString();
  const yest = addDays(now, -1);
  const atTime = (d: Date, h: number, m: number) => {
    const x = new Date(d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const hist = (text: string, by: string, d: Date) => ({ id: uid(), text, by, at: iso(d) });

  const base = {
    pharmacy: 'Oakwood Health Pharmacy',
    remindOffset: 0 as const,
    active: true,
    refillDays: 7,
    updatedAt: iso(now),
  };
  const meds: Medication[] = [
    {
      ...base, id: uid(), name: 'Cardiovex', strength: '10 mg', form: 'tablet', dose: 1, times: ['08:00'],
      instructions: 'Take with breakfast', food: 'with', prescriber: 'Dr. Elena Chen', purpose: 'Heart & blood pressure',
      appearance: 'Round · white · marked CV10', supply: 12, started: '2025-01-12', document: 'Sample prescription',
      tone: 'sage', history: [hist('Schedule reviewed', 'Margaret Wilson', addDays(now, -3)), hist('Medicine added', 'Sample record', new Date(2025, 0, 12, 9))],
    },
    {
      ...base, id: uid(), name: 'GlucoEase', strength: '500 mg', form: 'tablet', dose: 1, times: ['08:00'],
      instructions: 'Take with food', food: 'with', prescriber: 'Dr. Elena Chen', purpose: 'Blood sugar',
      appearance: 'Oval · white · marked GE500', supply: 24, started: '2025-03-03', document: 'Sample prescription',
      tone: 'sky', history: [hist('Refill recorded', 'Oakwood Health Pharmacy', addDays(now, -16)), hist('Medicine added', 'Sample record', new Date(2025, 2, 3, 9))],
    },
    {
      ...base, id: uid(), name: 'Vita-Dora', strength: '1,000 IU', form: 'capsule', dose: 1, times: ['13:00'],
      instructions: 'Take after lunch', food: 'after', prescriber: 'Dr. Marcus Hill', purpose: 'Vitamin D supplement',
      appearance: 'Small · yellow · soft capsule', supply: 60, started: '2025-02-20',
      tone: 'amber', history: [hist('Medicine added', 'Sample record', new Date(2025, 1, 20, 9))],
    },
    {
      ...base, id: uid(), name: 'Calmora', strength: '5 mg', form: 'tablet', dose: 1, times: ['19:00'],
      instructions: 'Take with water', food: 'none', prescriber: 'Dr. Marcus Hill', purpose: 'Evening medicine',
      appearance: 'Round · light blue · marked C5', supply: 3, started: '2025-04-08', document: 'Pharmacy label',
      tone: 'lav', history: [hist('Time changed from 8:00 PM to 7:00 PM', 'Dr. Marcus Hill', atTime(yest, 15, 40)), hist('Medicine added', 'Sample record', new Date(2025, 3, 8, 9))],
    },
    {
      ...base, id: uid(), name: 'ArthriRelief', strength: '20 mg', form: 'capsule', dose: 1, times: ['21:00'],
      instructions: 'Take after food', food: 'after', prescriber: 'Dr. Elena Chen', purpose: 'Joint pain',
      appearance: 'Capsule · white and orange', supply: 18, started: '2025-05-15', document: 'Sample prescription',
      tone: 'peach', history: [hist('Medicine added', 'Sample record', new Date(2025, 4, 15, 9))],
    },
  ];

  // Dose history for the past 30 days plus today's doses that are already due.
  const doses: DoseLog[] = [];
  for (let i = 30; i >= 0; i--) {
    const day = addDays(now, -i);
    const dk = dateKey(day);
    for (const m of meds) {
      for (const t of m.times) {
        const when = at(dk, t);
        if (when.getTime() > now.getTime()) continue;
        if ((i === 3 || i === 17) && m.name === 'ArthriRelief') continue; // a few missed doses
        if (i === 24 && m.name === 'GlucoEase') continue;
        const skipped = (i === 5 || i === 12) && m.name === 'Calmora';
        const bySarah = m.name === 'Vita-Dora' && i === 1;
        doses.push({
          id: uid(), medId: m.id, date: dk, time: t, status: skipped ? 'skipped' : 'taken',
          reason: skipped ? 'I felt unwell' : undefined, by: bySarah ? 'Sarah Collins' : 'Margaret Wilson',
          at: iso(new Date(when.getTime() + (bySarah ? 12 : 4) * 60000)),
        });
      }
    }
  }

  const activity: Activity[] = [
    { id: uid(), who: 'Dr. Marcus Hill', text: 'moved Calmora from 8:00 PM to 7:00 PM', at: iso(atTime(yest, 15, 40)) },
    { id: uid(), who: 'Sarah Collins', text: 'marked afternoon Vita-Dora as taken', at: iso(atTime(yest, 13, 12)) },
    { id: uid(), who: 'Margaret Wilson', text: 'uploaded a sample prescription', at: iso(atTime(addDays(now, -3), 10, 24)) },
  ];

  const profile: Profile = {
    name: 'Margaret Wilson',
    dob: `${now.getFullYear() - 68}-01-14`,
    phone: '(555) 014-7812',
    bloodGroup: 'O+',
    allergies: ['Penicillin'],
    emergency: { name: 'Sarah Collins', relation: 'Daughter', phone: '(555) 014-2280' },
    providers: [
      { id: uid(), name: 'Dr. Elena Chen', role: 'Primary care physician', org: 'Springfield Family Clinic' },
      { id: uid(), name: 'Dr. Marcus Hill', role: 'Clinical pharmacist', org: 'Oakwood Health Pharmacy' },
    ],
    pharmacy: 'Oakwood Health Pharmacy',
  };

  const members: Member[] = [
    {
      id: 'sample-sarah', name: 'Sarah Collins', relation: 'Daughter · Primary caregiver', contact: '(555) 014-2280',
      perms: { meds: true, mark: true, alerts: true, docs: false }, emergency: true, tone: 'peach', source: 'sample',
    },
    {
      id: 'sample-james', name: 'James Wilson', relation: 'Son · Family contact', contact: 'james@example.test',
      perms: { meds: true, mark: false, alerts: false, docs: false }, tone: 'sky', source: 'sample',
    },
  ];

  return { meds, doses, activity, profile, members };
}

export const emptyProfile = (name = ''): Profile => ({
  name,
  dob: '',
  phone: '',
  bloodGroup: '',
  allergies: [],
  emergency: { name: '', relation: '', phone: '' },
  providers: [],
  pharmacy: '',
});
