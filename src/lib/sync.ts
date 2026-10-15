import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { addDays, dateKey } from './dates';
import { inviteCode, uid } from './id';
import { activityRow, doseRow, medRow, publicProfile, useStore } from './store';
import { currentUserId, supabase } from './supabase';
import type { Activity, DoseLog, DoseStatus, Medication, Member, Perms, Profile } from './types';

// ---------------- row <-> app mapping ----------------
type DoseRowT = { id: string; med_id: string; date: string; time: string; status: DoseStatus; reason: string | null; by_name: string; by_user: string | null; at: string };
type ActivityRowT = { id: string; who: string; text: string; at: string; by_user: string | null };
type MemberRowT = {
  user_id: string; display_name: string; relation: string;
  can_view_meds: boolean; can_mark: boolean; can_alerts: boolean; can_docs: boolean;
};

const toDose = (r: DoseRowT): DoseLog => ({
  id: r.id, medId: r.med_id, date: r.date, time: r.time, status: r.status, reason: r.reason ?? undefined, by: r.by_name, at: r.at,
});
const toActivity = (r: ActivityRowT): Activity => ({ id: r.id, who: r.who, text: r.text, at: r.at });
const toMember = (r: MemberRowT): Member => ({
  id: r.user_id,
  name: r.display_name || 'Caregiver',
  relation: r.relation,
  perms: { meds: r.can_view_meds, mark: r.can_mark, alerts: r.can_alerts, docs: r.can_docs },
  tone: 'peach',
  source: 'shared',
});

function friendly(e: unknown): Error {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/Invalid login credentials/i.test(msg)) return new Error('That email and password do not match.');
  if (/Email not confirmed/i.test(msg)) return new Error('Please confirm your email first. Check your inbox for the link.');
  if (/User already registered/i.test(msg)) return new Error('An account with this email already exists. Sign in instead.');
  if (/Password should be/i.test(msg)) return new Error('Use a password with at least 6 characters.');
  if (/Failed to fetch|Network request failed/i.test(msg)) return new Error('No connection. Check your internet and try again.');
  return new Error(msg.replace(/^.*?:\s(?=[A-Z])/, ''));
}

// ---------------- account ----------------
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw friendly(error);
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error);
  await afterSignIn();
}

export async function signOut() {
  if (!supabase) return;
  stopOwnerLive();
  await supabase.auth.signOut();
  const st = useStore.getState();
  st.setSharing({ circleId: undefined, inviteCode: undefined, outbox: [] });
  st.setCaring([]);
  if (st.settings.mode === 'personal') st.setMembers([]);
}

/** After sign-in, reconnect to the circle this user owns and the circles they joined. */
export async function afterSignIn() {
  if (!supabase) return;
  const me = await currentUserId();
  if (!me) return;
  const st = useStore.getState();
  const { data: own } = await supabase.from('circles').select('id, invite_code').eq('owner', me).limit(1);
  if (own && own[0]) {
    st.setSharing({ circleId: own[0].id, inviteCode: own[0].invite_code, lastError: undefined });
    // new or reset phone: bring the schedule back from the account
    if (st.settings.mode === 'personal' && useStore.getState().meds.length === 0) await restoreFromCloud();
  }
  await refreshCaring();
}

/** Copies the medicines, recent doses and profile saved in the account back onto this phone. */
export async function restoreFromCloud(): Promise<number> {
  if (!supabase) return 0;
  const cid = useStore.getState().sharing.circleId;
  if (!cid) return 0;
  // never overwrite changes that have not reached the account yet
  if (useStore.getState().sharing.outbox.length && (await flush()) > 0) {
    throw new Error('Some changes on this phone have not synced yet. Connect to the internet and try again.');
  }
  const since = dateKey(addDays(new Date(), -60));
  const [circle, meds, doses] = await Promise.all([
    supabase.from('circles').select('patient_name, profile').eq('id', cid).maybeSingle(),
    supabase.from('medications').select('data').eq('circle_id', cid),
    supabase.from('dose_events').select('*').eq('circle_id', cid).gte('date', since),
  ]);
  if (meds.error) throw friendly(meds.error);
  const list = ((meds.data ?? []) as { data: Medication }[]).map((r) => r.data).filter(Boolean);
  const prof = (circle.data?.profile ?? {}) as Partial<CaringView['profile']> & { name?: string; providers?: Profile['providers'] };
  useStore.getState().restore({
    meds: list,
    doses: ((doses.data ?? []) as DoseRowT[]).map(toDose),
    profile: {
      name: prof.name || (circle.data?.patient_name as string | undefined) || undefined,
      allergies: prof.allergies,
      emergency: prof.emergency,
      pharmacy: prof.pharmacy,
      providers: prof.providers,
    },
  });
  return list.length;
}

// ---------------- the patient's own circle ----------------
export async function createCircle(): Promise<string> {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const st = useStore.getState();
  if (st.settings.mode !== 'personal') throw new Error('Sharing works with your own medicines, not the sample data.');
  if (st.sharing.circleId) return st.sharing.inviteCode ?? '';
  if (!(await currentUserId())) throw new Error('Sign in first.');
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = inviteCode();
    const id = uid();
    const { error } = await supabase
      .from('circles')
      .insert({ id, patient_name: st.profile.name, profile: publicProfile(st.profile), invite_code: code });
    if (!error) {
      st.setSharing({ circleId: id, inviteCode: code, outbox: [] });
      // upload what is already on the phone
      const since = dateKey(addDays(new Date(), -30));
      st.enqueue([
        ...st.meds.map((m) => ({ table: 'medications' as const, op: 'upsert' as const, row: medRow(id, m) })),
        ...st.doses.filter((d) => d.date >= since).map((d) => ({ table: 'dose_events' as const, op: 'upsert' as const, row: doseRow(id, d) })),
        ...st.activity.slice(0, 40).map((a) => ({ table: 'activity' as const, op: 'upsert' as const, row: activityRow(id, a) })),
      ]);
      await flush();
      startOwnerLive();
      return code;
    }
    lastErr = error;
    if (!/duplicate key/i.test(error.message)) break;
  }
  throw friendly(lastErr);
}

let flushing = false;
/** Sends queued changes to the shared circle. Safe to call often; works offline by waiting. */
export async function flush(): Promise<number> {
  if (!supabase || flushing) return 0;
  const st = useStore.getState();
  const { circleId, outbox } = st.sharing;
  if (!circleId || !outbox.length) return outbox.length;
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return outbox.length;
  if (!(await currentUserId())) {
    st.setSharing({ lastError: 'Sign in again to keep your schedule backed up.' });
    return outbox.length;
  }
  flushing = true;
  let failed: string | undefined;
  try {
    // keep order, but batch consecutive items for the same table + operation
    let i = 0;
    while (i < outbox.length) {
      const first = outbox[i];
      let j = i;
      while (j < outbox.length && outbox[j].table === first.table && outbox[j].op === first.op && j - i < 200) j++;
      const batch = outbox.slice(i, j);
      let error: { message: string; code?: string } | null = null;
      if (first.table === 'circles') {
        const last = batch[batch.length - 1].row as { patient_name: string; profile: unknown };
        ({ error } = await supabase.from('circles').update({ patient_name: last.patient_name, profile: last.profile }).eq('id', circleId));
      } else if (first.op === 'upsert') {
        // last write for the same row wins
        const rows = Array.from(new Map(batch.map((b) => [String(b.row.id), b.row])).values());
        ({ error } = await supabase.from(first.table).upsert(rows, first.table === 'activity' ? { ignoreDuplicates: true } : undefined));
      } else {
        ({ error } = await supabase.from(first.table).delete().in('id', batch.map((b) => String(b.row.id))));
      }
      if (error) {
        const permanent = /^(22|23|42)/.test(error.code ?? '');
        if (!permanent) break; // network or server trouble: try again later
        console.warn('Dropping a change the server rejected:', error.message);
        failed = `Some changes could not be saved to your account (${error.message}).`;
      }
      useStore.getState().dequeue(batch.map((b) => b.id));
      i = j;
    }
    useStore.getState().setSharing({ lastSync: new Date().toISOString(), lastError: failed });
  } finally {
    flushing = false;
  }
  return useStore.getState().sharing.outbox.length;
}

/** Pull caregiver changes (doses they marked, notes, membership) into the phone. */
export async function pullOwner() {
  if (!supabase) return;
  const st = useStore.getState();
  const cid = st.sharing.circleId;
  const me = await currentUserId();
  if (!cid || !me) return;
  const since = dateKey(addDays(new Date(), -14));
  const [doses, acts, members] = await Promise.all([
    supabase.from('dose_events').select('*').eq('circle_id', cid).gte('date', since).neq('by_user', me),
    supabase.from('activity').select('*').eq('circle_id', cid).order('at', { ascending: false }).limit(50),
    supabase.from('circle_members').select('*').eq('circle_id', cid),
  ]);
  for (const r of (doses.data ?? []) as DoseRowT[]) useStore.getState().applyRemoteDose(toDose(r));
  useStore.getState().mergeRemoteActivity(((acts.data ?? []) as ActivityRowT[]).map(toActivity));
  if (members.data) useStore.getState().setMembers((members.data as MemberRowT[]).map(toMember));
}

let ownerChannel: RealtimeChannel | null = null;
export function startOwnerLive(onNudge?: (a: Activity) => void) {
  if (!supabase) return;
  const cid = useStore.getState().sharing.circleId;
  if (!cid) return;
  stopOwnerLive();
  void currentUserId().then((me) => {
    if (!supabase || !me) return;
    ownerChannel = supabase
      .channel(`owner-${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dose_events', filter: `circle_id=eq.${cid}` }, (p) => {
        const r = p.new as DoseRowT;
        if (r.by_user !== me) useStore.getState().applyRemoteDose(toDose(r));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dose_events', filter: `circle_id=eq.${cid}` }, (p) => {
        const r = p.new as DoseRowT;
        if (r.by_user !== me) useStore.getState().applyRemoteDose(toDose(r));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `circle_id=eq.${cid}` }, (p) => {
        const r = p.new as ActivityRowT;
        if (r.by_user === me) return;
        const a = toActivity(r);
        useStore.getState().mergeRemoteActivity([a]);
        if (/sent a reminder/i.test(a.text)) onNudge?.(a);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_members', filter: `circle_id=eq.${cid}` }, () => {
        void pullOwner();
      })
      .subscribe();
  });
}
export function stopOwnerLive() {
  if (ownerChannel && supabase) void supabase.removeChannel(ownerChannel);
  ownerChannel = null;
}

export async function updateMemberPerms(memberId: string, perms: Perms) {
  const st = useStore.getState();
  const member = st.members.find((m) => m.id === memberId);
  st.setMemberPerms(memberId, perms);
  if (!supabase || !member || member.source !== 'shared' || !st.sharing.circleId) return;
  const { error } = await supabase
    .from('circle_members')
    .update({ can_view_meds: perms.meds, can_mark: perms.mark, can_alerts: perms.alerts, can_docs: perms.docs })
    .eq('circle_id', st.sharing.circleId)
    .eq('user_id', memberId);
  if (error) {
    st.setMemberPerms(memberId, member.perms);
    throw friendly(error);
  }
}

export async function removeMember(memberId: string) {
  const st = useStore.getState();
  const member = st.members.find((m) => m.id === memberId);
  st.setMembers(st.members.filter((m) => m.id !== memberId));
  if (!supabase || !member || member.source !== 'shared' || !st.sharing.circleId) return;
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', st.sharing.circleId).eq('user_id', memberId);
  if (error) throw friendly(error);
  st.addActivity(`removed ${member.name} from the care circle`);
}

// ---------------- caregiver side ----------------
export async function joinCircle(code: string, myName: string, relation: string) {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  if (!(await currentUserId())) throw new Error('Sign in first.');
  const { data, error } = await supabase.rpc('join_circle', { code: code.trim().toUpperCase(), name: myName.trim(), rel: relation });
  if (error) throw friendly(error);
  const res = data as { circle_id: string; patient_name: string };
  const st = useStore.getState();
  st.setCaring([
    ...st.caring.filter((c) => c.circleId !== res.circle_id),
    { circleId: res.circle_id, patientName: res.patient_name || 'Patient', myName: myName.trim() },
  ]);
  return res;
}

export async function refreshCaring() {
  if (!supabase) return;
  const me = await currentUserId();
  if (!me) return;
  const { data } = await supabase.from('circle_members').select('circle_id, display_name, circles(patient_name)').eq('user_id', me);
  if (!data) return;
  type Row = { circle_id: string; display_name: string; circles: { patient_name: string } | { patient_name: string }[] | null };
  useStore.getState().setCaring(
    (data as Row[]).map((r) => {
      const c = Array.isArray(r.circles) ? r.circles[0] : r.circles;
      return { circleId: r.circle_id, patientName: c?.patient_name || 'Patient', myName: r.display_name };
    }),
  );
}

export async function leaveCircle(circleId: string) {
  if (!supabase) return;
  const me = await currentUserId();
  if (!me) return;
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', me);
  if (error) throw friendly(error);
  const st = useStore.getState();
  st.setCaring(st.caring.filter((c) => c.circleId !== circleId));
}

export interface CaringView {
  patientName: string;
  profile: { allergies?: string[]; emergency?: { name: string; relation: string; phone: string }; pharmacy?: string };
  meds: Medication[];
  doses: DoseLog[];
  activity: Activity[];
  perms: Perms;
}

export async function loadCaring(circleId: string): Promise<CaringView> {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const me = await currentUserId();
  const since = dateKey(addDays(new Date(), -6));
  const [circle, meds, doses, acts, mine] = await Promise.all([
    supabase.from('circles').select('patient_name, profile').eq('id', circleId).maybeSingle(),
    supabase.from('medications').select('data').eq('circle_id', circleId),
    supabase.from('dose_events').select('*').eq('circle_id', circleId).gte('date', since),
    supabase.from('activity').select('*').eq('circle_id', circleId).order('at', { ascending: false }).limit(30),
    supabase.from('circle_members').select('*').eq('circle_id', circleId).eq('user_id', me ?? '').maybeSingle(),
  ]);
  if (circle.error) throw friendly(circle.error);
  if (!circle.data) throw new Error('You are no longer part of this care circle.');
  const m = mine.data as MemberRowT | null;
  return {
    patientName: circle.data.patient_name as string,
    profile: (circle.data.profile ?? {}) as CaringView['profile'],
    meds: ((meds.data ?? []) as { data: Medication }[]).map((r) => r.data).filter((x) => x && x.active !== false),
    doses: ((doses.data ?? []) as DoseRowT[]).map(toDose),
    activity: ((acts.data ?? []) as ActivityRowT[]).map(toActivity),
    perms: m ? toMember(m).perms : { meds: false, mark: false, alerts: false, docs: false },
  };
}

export function watchCaring(circleId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const ch = supabase
    .channel(`caring-${circleId}-${uid().slice(0, 6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_events', filter: `circle_id=eq.${circleId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medications', filter: `circle_id=eq.${circleId}` }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `circle_id=eq.${circleId}` }, onChange)
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(ch);
  };
}

export async function caregiverMark(circleId: string, med: Medication, date: string, time: string, status: DoseStatus, myName: string) {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const { error } = await supabase.from('dose_events').insert({
    id: uid(), circle_id: circleId, med_id: med.id, date, time, status, by_name: myName, at: new Date().toISOString(),
  });
  if (error) throw friendly(error);
  await supabase.from('activity').insert({ id: uid(), circle_id: circleId, who: myName, text: `marked ${med.name} as ${status}` });
}

export async function caregiverNudge(circleId: string, med: Medication, time: string, myName: string) {
  if (!supabase) throw new Error('Sharing is not set up yet.');
  const { error } = await supabase
    .from('activity')
    .insert({ id: uid(), circle_id: circleId, who: myName, text: `sent a reminder about ${med.name} (${time})` });
  if (error) throw friendly(error);
}
