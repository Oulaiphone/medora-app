import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { label, longDay, shortDate, slotOf } from './dates';
import { FOOD_LABEL, unitWord } from './schedule';
import { TONES } from './theme';
import type { Medication, Profile } from './types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function placeholder(m: Medication): string {
  const t = TONES[m.tone] ?? TONES.green;
  const caps = m.name.match(/[A-Z]/g) ?? [];
  const ab = (caps.length >= 2 ? caps.slice(0, 2).join('') : m.name.slice(0, 2)).toUpperCase();
  return `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="${t.bg}"/><text x="32" y="39" font-family="Helvetica,Arial" font-size="20" font-weight="700" text-anchor="middle" fill="${t.fg}">${esc(ab)}</text></svg>`;
}

const SLOT_ICON: Record<string, string> = { Morning: '☀︎', Afternoon: '◐', Evening: '☾', Night: '☾' };

/** One-page medication plan for the fridge, a wallet or an emergency visit. */
export function planHtml(profile: Profile, meds: Medication[], now: Date = new Date()): string {
  const active = meds.filter((m) => m.active).sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? ''));
  const updated = active.reduce((acc, m) => (m.updatedAt > acc ? m.updatedAt : acc), '');
  const updatedText = updated ? shortDate(updated.slice(0, 10)) : longDay(now);
  const rows = active
    .map((m) => {
      const pic = m.photo ? `<img src="${m.photo}" alt="">` : placeholder(m);
      const times = m.times
        .map((t) => `<span class="time">${SLOT_ICON[slotOf(t)] ?? ''} ${label(t)}</span>`)
        .join(' ');
      return `<tr>
        <td class="pic">${pic}</td>
        <td><div class="name">${esc(m.name)}</div><div class="dose">${esc(m.strength)} ${esc(unitWord(m.form, 1))}</div>
          <div class="take">Take <b>${m.dose === 0.5 ? '½' : m.dose}</b> ${esc(unitWord(m.form, m.dose))}</div>
          ${m.appearance ? `<div class="mut">${esc(m.appearance)}</div>` : ''}</td>
        <td>${times}</td>
        <td><div>${esc(m.instructions)}</div>${m.food !== 'none' ? `<div class="mut">${FOOD_LABEL[m.food]}</div>` : ''}${m.purpose ? `<div class="mut">For: ${esc(m.purpose)}</div>` : ''}</td>
        <td class="check"></td>
      </tr>`;
    })
    .join('');
  const wallet = active.map((m) => `<li><b>${esc(m.name)} ${esc(m.strength)}</b> · ${m.dose} at ${m.times.map(label).join(', ')}</li>`).join('');
  const em = profile.emergency;
  const contacts = [
    em.name ? `<div><b>Emergency:</b> ${esc(em.name)}${em.relation ? ` (${esc(em.relation)})` : ''} · <b>${esc(em.phone)}</b></div>` : '',
    ...profile.providers.map((p) => `<div><b>${esc(p.name)}</b>, ${esc(p.role)}${p.org ? `, ${esc(p.org)}` : ''}</div>`),
    profile.pharmacy ? `<div><b>Pharmacy:</b> ${esc(profile.pharmacy)}</div>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{margin:14mm}
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1C2B27;font-size:13px;margin:0}
  .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #2E6A55;padding-bottom:8px}
  h1{font-size:26px;margin:0;color:#1F4D40} .who{font-size:16px;margin-top:2px}
  .updated{text-align:right;font-size:12px;color:#5D6B67} .updated b{color:#1C2B27;font-size:14px}
  .boxes{display:flex;gap:10px;margin:12px 0}
  .box{flex:1;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5}
  .allergy{background:#FBE7E5;border:2px solid #A83434;color:#7d2323} .allergy .t{font-size:15px;font-weight:700}
  .contacts{background:#EAF4F2;border:1px solid #CFE3DF}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5D6B67;text-align:left;padding:6px;border-bottom:2px solid #CFE3DF}
  td{padding:9px 6px;border-bottom:1px solid #E3E7E5;vertical-align:top}
  td.pic{width:70px} td.pic img,td.pic svg{width:64px;height:64px;border-radius:12px;object-fit:cover;display:block}
  .name{font-size:17px;font-weight:700} .dose{font-size:14px} .take{margin-top:3px} .mut{color:#5D6B67;font-size:12px}
  .time{display:inline-block;background:#E7F1ED;color:#1F4D40;border-radius:999px;padding:3px 9px;margin:2px 2px 2px 0;font-weight:700;font-size:13px;white-space:nowrap}
  td.check{width:52px;border-left:1px dashed #CFE3DF}
  .foot{margin-top:12px;font-size:11px;color:#5D6B67}
  .wallet{margin-top:18px;border:1.5px dashed #9AA8A3;border-radius:10px;width:3.4in;padding:10px 12px;font-size:11px}
  .wallet h2{font-size:13px;margin:0 0 4px;color:#1F4D40} .wallet ul{margin:4px 0;padding-left:16px}
  </style></head><body>
  <div class="head"><div><h1>My medication plan</h1><div class="who"><b>${esc(profile.name || 'Name')}</b>${profile.dob ? ` · born ${esc(profile.dob)}` : ''}${profile.bloodGroup ? ` · blood group ${esc(profile.bloodGroup)}` : ''}</div></div>
  <div class="updated">Last updated<br><b>${updatedText}</b></div></div>
  <div class="boxes">
    <div class="box allergy"><div class="t">⚠ Allergies</div>${profile.allergies.length ? esc(profile.allergies.join(', ')) : 'No allergies recorded'}</div>
    <div class="box contacts">${contacts || 'Add an emergency contact in MedOra → Profile.'}</div>
  </div>
  <table><thead><tr><th></th><th>Medicine</th><th>When</th><th>Instructions</th><th>✓</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No medicines yet.</td></tr>'}</tbody></table>
  <p class="foot">Keep this on your fridge or bring it to appointments and emergency visits. Print a new copy when your medicines change. Made with MedOra from information entered by the patient or caregivers; confirm changes with your doctor or pharmacist.</p>
  <div class="wallet"><h2>✂ Wallet card · ${esc(profile.name || '')}</h2>
    <div><b>Allergies:</b> ${profile.allergies.length ? esc(profile.allergies.join(', ')) : 'None recorded'}</div>
    <ul>${wallet}</ul>
    ${em.name ? `<div><b>Emergency:</b> ${esc(em.name)} ${esc(em.phone)}</div>` : ''}
    <div class="mut">Updated ${updatedText}</div></div>
  </body></html>`;
}

/** Opens the phone's print dialog (AirPrint on iPhone). */
export async function printPlan(profile: Profile, meds: Medication[]) {
  await Print.printAsync({ html: planHtml(profile, meds) });
}

/** Saves the plan as a PDF and opens the share menu. */
export async function sharePlanPdf(profile: Profile, meds: Medication[]) {
  const html = planHtml(profile, meds);
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Medication plan' });
  }
}
