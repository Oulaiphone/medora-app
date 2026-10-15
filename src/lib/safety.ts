// A small, deliberately cautious allergy check. It is not a drug-interaction database.
const FAMILIES: Record<string, string[]> = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'piperacillin', 'nafcillin', 'oxacillin', 'dicloxacillin', 'cloxacillin', 'flucloxacillin', 'ticarcillin', 'pivmecillinam'],
  sulfa: ['sulfamethoxazole', 'bactrim', 'septra', 'sulfasalazine', 'sulfadiazine'],
  nsaid: ['ibuprofen', 'naproxen', 'aspirin', 'diclofenac', 'celecoxib', 'meloxicam', 'ketorolac', 'indomethacin', 'advil', 'aleve', 'motrin'],
  codeine: ['codeine', 'tylenol #3', 'tylenol with codeine'],
  cephalosporin: ['cephalexin', 'keflex', 'cefuroxime', 'ceftriaxone', 'cefdinir', 'cefazolin'],
  statin: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin'],
};

export function allergyMatches(medName: string, allergies: string[]): string[] {
  const name = medName.toLowerCase();
  const hits: string[] = [];
  for (const raw of allergies) {
    const a = raw.trim().toLowerCase();
    if (!a) continue;
    if (name.includes(a) || a.includes(name)) {
      hits.push(raw);
      continue;
    }
    for (const [family, members] of Object.entries(FAMILIES)) {
      const allergyIsFamily = a.includes(family) || members.some((m) => a.includes(m));
      if (allergyIsFamily && members.some((m) => name.includes(m))) {
        hits.push(raw);
        break;
      }
    }
  }
  return hits;
}
