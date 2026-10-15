// MedOra design tokens, taken from the team's Figma Make prototype.
export const C = {
  bg: '#F6F7F5',
  card: '#FFFFFF',
  line: '#E3E7E5',
  line2: '#EEF1EF',
  ink: '#1C2B27',
  muted: '#5D6B67',
  soft: '#4F5D59',
  faint: '#9AA8A3',
  green: '#2E6A55',
  green2: '#2C5E4F',
  deep: '#1F4D40',
  night: '#183A30',
  night2: '#10291F',
  mint: '#3E8A6E',
  tint: '#EAF4F2',
  tint2: '#CFE3DF',
  iconbg: '#E7F1ED',
  navon: '#E6F0EC',
  amber: '#8A5A10',
  amberbg: '#FBF0DC',
  amberdot: '#E3A33B',
  orange: '#A94E17',
  orangebg: '#FBEBDD',
  red: '#A83434',
  redbg: '#FBE7E5',
  peach: '#FBE9DE',
  peachink: '#A8552F',
  sage: '#E3F1EA',
  sageink: '#2E6B52',
  lav: '#ECEBF8',
  lavink: '#4D4A8F',
  sky: '#E4EEF8',
  skyink: '#2F5C8A',
  skip: '#E9ECEA',
  afternoon: '#4F93B0',
  evening: '#6D63B0',
  white: '#FFFFFF',
  scrim: 'rgba(16,32,27,0.45)',
};

export const F = {
  r: 'DMSans_400Regular',
  m: 'DMSans_500Medium',
  sb: 'DMSans_600SemiBold',
  b: 'DMSans_700Bold',
};

export const TONES = {
  sage: { bg: C.sage, fg: C.sageink },
  sky: { bg: C.sky, fg: C.skyink },
  amber: { bg: C.amberbg, fg: C.amber },
  lav: { bg: C.lav, fg: C.lavink },
  peach: { bg: C.peach, fg: C.peachink },
  green: { bg: C.iconbg, fg: C.deep },
} as const;
export type Tone = keyof typeof TONES;
export const TONE_LIST: Tone[] = ['sage', 'sky', 'amber', 'lav', 'peach', 'green'];
