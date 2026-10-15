import * as Speech from 'expo-speech';

import { label } from './dates';
import { doseSentence } from './schedule';
import type { Food, Medication, Settings } from './types';

type Lang = Settings['voiceLang'];

const FOOD: Record<Exclude<Lang, 'en-US'>, Record<Food, string>> = {
  'es-ES': { with: 'con comida', after: 'después de comer', before: 'antes de comer', empty: 'con el estómago vacío', none: '' },
  'zh-CN': { with: '随餐服用', after: '饭后服用', before: '饭前服用', empty: '空腹服用', none: '' },
};

function unitEs(form: string, n: number) {
  const f = form.toLowerCase();
  const base = f.startsWith('cap') ? 'cápsula' : f.startsWith('tab') ? 'tableta' : f.startsWith('puff') ? 'inhalación' : f.startsWith('drop') ? 'gota' : 'dosis';
  return n === 1 || base === 'dosis' ? base : `${base}s`;
}
function unitZh(form: string) {
  const f = form.toLowerCase();
  return f.startsWith('cap') ? '粒' : f.startsWith('tab') ? '片' : f.startsWith('puff') ? '喷' : f.startsWith('drop') ? '滴' : '剂';
}

export function reminderScript(med: Medication, time: string, lang: Lang, name?: string): string {
  const who = name ? name.split(' ')[0] : '';
  if (lang === 'es-ES') {
    const food = FOOD['es-ES'][med.food];
    return `${who ? `${who}, ` : ''}son las ${label(time)}. Es hora de tomar ${med.name}, ${med.strength}. Tome ${med.dose === 1 ? 'una' : med.dose} ${unitEs(med.form, med.dose)}${food ? ` ${food}` : ''}.`;
  }
  if (lang === 'zh-CN') {
    const food = FOOD['zh-CN'][med.food];
    return `${who ? `${who}，` : ''}现在是${label(time)}。请服用 ${med.name} ${med.strength}，每次${med.dose}${unitZh(med.form)}${food ? `，${food}` : ''}。`;
  }
  return `${who ? `${who}, ` : ''}it's ${label(time)}. Time to take ${med.name}, ${med.strength}. ${doseSentence(med)}.`;
}

export function speak(text: string, lang: Lang, onDone?: () => void) {
  Speech.stop();
  Speech.speak(text, { language: lang, rate: 0.92, onDone, onStopped: onDone, onError: onDone });
}

export function stopSpeaking() {
  void Speech.stop();
}
