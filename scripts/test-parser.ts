// Run with: npm run test:parser
// Checks that the label reader turns real-looking pharmacy label text into the right fields.
import { parseLabel, SAMPLE_LABEL_TEXT } from '../src/lib/parseLabel';
import { allergyMatches } from '../src/lib/safety';

type Expect = Partial<{ name: string; strength: string; form: string; dose: number; times: string[]; food: string; prescriber: string; supply: number | null }>;

const cases: [string, string, Expect][] = [
  ['built-in sample', SAMPLE_LABEL_TEXT, { name: 'Respira-Lite', strength: '25 mcg', times: ['08:30'], prescriber: 'Dr. Elena Chen', supply: 30 }],
  ['once daily', 'CVS pharmacy\nRx 0123456  Dr. JOHN SMITH\nLISINOPRIL 10MG TABLETS\nTAKE ONE TABLET BY MOUTH EVERY DAY\nQTY 90  REFILLS: 3', { name: 'Lisinopril', strength: '10 mg', times: ['08:00'], dose: 1, supply: 90 }],
  ['twice daily with meals', 'METFORMIN HCL 500 MG TAB\nTake 1 tablet by mouth twice daily with meals\nQty: 60 Refills: 5\nPrescriber: Dr. Patel', { name: 'Metformin', times: ['08:00', '20:00'], food: 'with', prescriber: 'Dr. Patel' }],
  ['bedtime', 'ATORVASTATIN 20MG\nTAKE 1 TABLET AT BEDTIME\n#30', { name: 'Atorvastatin', times: ['21:00'], supply: 30 }],
  ['three times a day', 'AMOXICILLIN 500 MG CAPSULES\nTAKE 1 CAPSULE BY MOUTH THREE TIMES A DAY', { form: 'capsule', times: ['08:00', '14:00', '20:00'] }],
  ['two puffs', 'ALBUTEROL HFA 90 MCG INHALER\nINHALE 2 PUFFS EVERY 6 HOURS AS NEEDED', { form: 'puff', dose: 2 }],
  ['units with comma', 'VITAMIN D3 1,000 IU SOFTGELS\nTake 1 softgel daily with a meal', { name: 'Vitamin D3', strength: '1,000 IU', form: 'softgel', food: 'with' }],
];

let failed = 0;
for (const [label, text, want] of cases) {
  const got = parseLabel(text) as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(want)) {
    const ok = JSON.stringify(got[k]) === JSON.stringify(v);
    if (!ok) {
      failed++;
      console.log(`✗ ${label}: ${k} = ${JSON.stringify(got[k])}, expected ${JSON.stringify(v)}`);
    }
  }
}
const allergy: [string, string[], boolean][] = [
  ['Amoxicillin', ['Penicillin'], true],
  ['Cardiovex', ['Penicillin'], false],
  ['Ibuprofen', ['NSAIDs'], true],
];
for (const [med, list, expected] of allergy) {
  if (allergyMatches(med, list).length > 0 !== expected) {
    failed++;
    console.log(`✗ allergy check ${med} vs ${list.join(', ')}`);
  }
}
console.log(failed ? `${failed} check(s) failed` : `All ${cases.length + allergy.length} checks passed`);
if (failed) throw new Error('tests failed');
