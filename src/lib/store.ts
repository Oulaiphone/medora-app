import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDays, dateKey, label } from './dates';
import { uid } from './id';
import { emptyProfile, sampleData } from './sample';
import { TONE_LIST } from './theme';
import type {
  Activity, CaringFor, DoseLog, DoseStatus, Medication, Member, OutboxItem, Perms, Profile, ScanDraft, Settings, Sharing,
} from './types';

export type NewMed = Omit<Medication, 'id' | 'history' | 'updatedAt' | 'tone' | 'active'> & { tone?: Medication['tone'] };

interface State {
  hydrated: boolean;
  settings: Settings;
  profile: Profile;
  meds: Medication[];
  doses: DoseLog[];
  activity: Activity[];
  members: Member[];
  sharing: Sharing;
  caring: CaringFor[];
  scanDraft: ScanDraft | null;
  handled: string[];

  startDemo: () => void;
  startPersonal: (name: string) => void;
  resetAll: () => void;
  setSettings: (p: Partial<Settings>) => void;
  setProfile: (p: Partial<Profile>) => void;
  addMed: (m: NewMed, via?: string) => Medication;
  updateMed: (id: string, patch: Partial<Medication>, historyText?: string) => void;
  removeMed: (id: string) => void;
  logDose: (medId: string, date: string, time: string, status: DoseStatus, reason?: string) => void;
  undoDose: (medId: string, date: string, time: string) => void;
  noteSideEffect: (medId: string, text: string) => void;
  addActivity: (text: string, who?: string) => void;
  setMemberPerms: (id: string, perms: Perms) => void;
  setMembers: (members: Member[]) => void;
  setScanDraft: (d: ScanDraft | null) => void;
  setSharing: (p: Partial<Sharing>) => void;
  enqueue: (items: Omit<OutboxItem, 'id'>[]) => void;
  dequeue: (ids: string[]) => void;
  setCaring: (list: CaringFor[]) => void;
  applyRemoteDose: (log: DoseLog) => void;
  removeRemoteDose: (id: string) => void;
  mergeRemoteActivity: (items: Activity[]) => void;
  markHandled: (id: string) => void;
  restore: (d: { meds: Medication[]; doses: DoseLog[]; profile: Partial<Profile> }) => void;
}

const defaultSettings: Settings = {
  onboarded: false,
  mode: 'personal',
  largeText: false,
  simpleHome: false,
  remindersOn: false,
  followUp: true,
  voiceLang: 'en-US',
};

const now = () => new Date().toISOString();

// ---- row mappers for the shared (Supabase) tables ----
export const medRow = (cid: string, m: Medication) => ({ id: m.id, circle_id: cid, data: m, updated_at: m.updatedAt });
export const doseRow = (cid: string, d: DoseLog) => ({
  id: d.id, circle_id: cid, med_id: d.medId, date: d.date, time: d.time, status: d.status, reason: d.reason ?? null, by_name: d.by, at: d.at,
});
export const activityRow = (cid: string, a: Activity) => ({ id: a.id, circle_id: cid, who: a.who, text: a.text, at: a.at });

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const me = () => get().profile.name || 'You';
      /** queue a change for the shared care circle (only when sharing is on, never for sample data) */
      const share = (items: Omit<OutboxItem, 'id'>[]) => {
        const { sharing, settings } = get();
        if (!sharing.circleId || settings.mode !== 'personal') return;
        get().enqueue(items);
      };
      const activity = (text: string, who = me()): Activity => {
        const a = { id: uid(), who, text, at: now() };
        set((s) => ({ activity: [a, ...s.activity].slice(0, 300) }));
        const cid = get().sharing.circleId;
        if (cid) share([{ table: 'activity', op: 'upsert', row: activityRow(cid, a) }]);
        return a;
      };
      const touchMed = (id: string, patch: Partial<Medication>, historyText?: string) => {
        let updated: Medication | undefined;
        set((s) => ({
          meds: s.meds.map((m) => {
            if (m.id !== id) return m;
            updated = {
              ...m,
              ...patch,
              updatedAt: now(),
              history: historyText ? [{ id: uid(), text: historyText, by: me(), at: now() }, ...m.history] : m.history,
            };
            return updated;
          }),
        }));
        const cid = get().sharing.circleId;
        if (cid && updated) share([{ table: 'medications', op: 'upsert', row: medRow(cid, updated) }]);
      };

      return {
        hydrated: false,
        settings: defaultSettings,
        profile: emptyProfile(),
        meds: [],
        doses: [],
        activity: [],
        members: [],
        sharing: { outbox: [] },
        caring: [],
        scanDraft: null,
        handled: [],

        startDemo: () => {
          const d = sampleData();
          set({
            settings: { ...defaultSettings, onboarded: true, mode: 'demo' },
            profile: d.profile,
            meds: d.meds,
            doses: d.doses,
            activity: d.activity,
            members: d.members,
          });
        },
        startPersonal: (name) => {
          set((s) => ({
            settings: { ...defaultSettings, onboarded: true, mode: 'personal', largeText: s.settings.largeText },
            profile: emptyProfile(name.trim()),
            meds: [],
            doses: [],
            activity: [],
            members: [],
          }));
        },
        resetAll: () =>
          set({
            settings: defaultSettings,
            profile: emptyProfile(),
            meds: [],
            doses: [],
            activity: [],
            members: [],
            sharing: { outbox: [] },
            caring: [],
            scanDraft: null,
            handled: [],
          }),
        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        setProfile: (p) => {
          set((s) => ({ profile: { ...s.profile, ...p } }));
          const { sharing, profile } = get();
          if (sharing.circleId) {
            share([{ table: 'circles', op: 'upsert', row: { id: sharing.circleId, patient_name: profile.name, profile: publicProfile(profile) } }]);
          }
        },
        addMed: (m, via = 'Medicine added') => {
          const used = new Set(get().meds.map((x) => x.tone));
          const tone = m.tone ?? TONE_LIST.find((t) => !used.has(t)) ?? TONE_LIST[get().meds.length % TONE_LIST.length];
          const med: Medication = {
            ...m,
            id: uid(),
            tone,
            active: true,
            times: [...m.times].sort(),
            updatedAt: now(),
            history: [{ id: uid(), text: via, by: me(), at: now() }],
          };
          set((s) => ({ meds: [...s.meds, med] }));
          activity(`added ${med.name} ${med.strength}`.trim());
          const cid = get().sharing.circleId;
          if (cid) share([{ table: 'medications', op: 'upsert', row: medRow(cid, med) }]);
          return med;
        },
        updateMed: (id, patch, historyText) => {
          if (patch.times) patch = { ...patch, times: [...patch.times].sort() };
          touchMed(id, patch, historyText);
        },
        removeMed: (id) => {
          const med = get().meds.find((m) => m.id === id);
          set((s) => ({ meds: s.meds.filter((m) => m.id !== id) }));
          if (med) activity(`removed ${med.name}`);
          const cid = get().sharing.circleId;
          if (cid) share([{ table: 'medications', op: 'delete', row: { id } }]);
        },
        logDose: (medId, date, time, status, reason) => {
          const med = get().meds.find((m) => m.id === medId);
          if (!med) return;
          const prev = get().doses.find((d) => d.medId === medId && d.date === date && d.time === time);
          const log: DoseLog = { id: prev?.id ?? uid(), medId, date, time, status, reason, by: me(), at: now() };
          set((s) => ({ doses: [log, ...s.doses.filter((d) => d !== prev)].filter((d) => d.date >= dateKey(addDays(new Date(), -400))) }));
          // supply follows taken doses
          let supply = med.supply;
          if (supply != null) {
            if (status === 'taken' && prev?.status !== 'taken') supply = Math.max(0, supply - med.dose);
            if (status !== 'taken' && prev?.status === 'taken') supply = supply + med.dose;
          }
          const isToday = date === dateKey();
          const when = isToday ? `${label(time)} ` : '';
          const text =
            status === 'taken'
              ? `Today's ${when}dose marked as taken`
              : `Today's ${when}dose skipped${reason ? `: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : ''}`;
          touchMed(medId, { supply }, isToday ? text : `${date} dose marked as ${status}`);
          activity(status === 'taken' ? `marked ${med.name} as taken` : `skipped ${med.name}${reason ? ` (${reason.toLowerCase()})` : ''}`);
          const cid = get().sharing.circleId;
          if (cid) share([{ table: 'dose_events', op: 'upsert', row: doseRow(cid, log) }]);
        },
        undoDose: (medId, date, time) => {
          const prev = get().doses.find((d) => d.medId === medId && d.date === date && d.time === time);
          const med = get().meds.find((m) => m.id === medId);
          if (!prev || !med) return;
          set((s) => ({ doses: s.doses.filter((d) => d !== prev) }));
          const supply = med.supply != null && prev.status === 'taken' ? med.supply + med.dose : med.supply;
          touchMed(medId, { supply }, `${prev.status === 'taken' ? 'Taken' : 'Skipped'} mark removed`);
          const cid = get().sharing.circleId;
          if (cid) share([{ table: 'dose_events', op: 'delete', row: { id: prev.id } }]);
        },
        noteSideEffect: (medId, text) => {
          const med = get().meds.find((m) => m.id === medId);
          if (!med) return;
          touchMed(medId, {}, `Side effect noted: ${text}`);
          activity(`noted a side effect with ${med.name}: ${text}`);
        },
        addActivity: (text, who) => {
          activity(text, who);
        },
        setMemberPerms: (id, perms) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, perms } : m)) })),
        setMembers: (members) => set({ members }),
        setScanDraft: (d) => set({ scanDraft: d }),
        setSharing: (p) => set((s) => ({ sharing: { ...s.sharing, ...p } })),
        enqueue: (items) =>
          set((s) => ({ sharing: { ...s.sharing, outbox: [...s.sharing.outbox, ...items.map((i) => ({ ...i, id: uid() }))] } })),
        dequeue: (ids) => set((s) => ({ sharing: { ...s.sharing, outbox: s.sharing.outbox.filter((o) => !ids.includes(o.id)) } })),
        setCaring: (list) => set({ caring: list }),
        applyRemoteDose: (log) => {
          const st = get();
          if (st.doses.some((d) => d.id === log.id && d.status === log.status)) return;
          const med = st.meds.find((m) => m.id === log.medId);
          if (!med) return;
          const prev = st.doses.find((d) => d.medId === log.medId && d.date === log.date && d.time === log.time);
          let supply = med.supply;
          if (supply != null) {
            if (log.status === 'taken' && prev?.status !== 'taken') supply = Math.max(0, supply - med.dose);
            if (log.status !== 'taken' && prev?.status === 'taken') supply = supply + med.dose;
          }
          const updated: Medication = {
            ...med,
            supply,
            updatedAt: now(),
            history: [{ id: uid(), text: `${label(log.time)} dose marked as ${log.status}`, by: log.by, at: log.at }, ...med.history],
          };
          set((s) => ({
            doses: [log, ...s.doses.filter((d) => d !== prev && d.id !== log.id)],
            meds: s.meds.map((m) => (m.id === med.id ? updated : m)),
          }));
          const cid = get().sharing.circleId;
          if (cid) share([{ table: 'medications', op: 'upsert', row: medRow(cid, updated) }]);
        },
        removeRemoteDose: (id) => set((s) => ({ doses: s.doses.filter((d) => d.id !== id) })),
        mergeRemoteActivity: (items) =>
          set((s) => {
            const known = new Set(s.activity.map((a) => a.id));
            const fresh = items.filter((a) => !known.has(a.id));
            if (!fresh.length) return {};
            return { activity: [...fresh, ...s.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300) };
          }),
        markHandled: (id) => set((s) => ({ handled: [id, ...s.handled].slice(0, 50) })),
        restore: ({ meds, doses, profile }) => {
          set((s) => ({
            meds,
            doses,
            profile: { ...s.profile, ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v != null && v !== '')) },
          }));
          if (meds.length) {
            const a = { id: uid(), who: get().profile.name || 'You', text: `restored ${meds.length} medicine${meds.length === 1 ? '' : 's'} from your account`, at: now() };
            set((s) => ({ activity: [a, ...s.activity] }));
          }
        },
      };
    },
    {
      name: 'medora-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        return rest;
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/** What caregivers in the circle can see about the patient */
export function publicProfile(p: Profile) {
  return { name: p.name, allergies: p.allergies, emergency: p.emergency, pharmacy: p.pharmacy, providers: p.providers };
}

export const meName = () => useStore.getState().profile.name || 'You';
