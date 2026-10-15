import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Pictorial, STATUS } from '@/components/meds';
import { BackBar, Btn, Callout, Card, Chip, Choice, Field, MedBadge, Over, Screen, Sheet, T, toast } from '@/components/ui';
import { ago, dateKey, label, shortDate } from '@/lib/dates';
import { dosesFor, refillDue, supplyText, unitWord, type DoseSlot } from '@/lib/schedule';
import { reminderScript, speak, stopSpeaking } from '@/lib/speech';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const REASONS = ['I felt unwell', 'I ran out', 'My doctor told me to', 'Too late to take it', 'Other reason'] as const;
const EFFECTS = ['Dizziness', 'Upset stomach', 'Headache', 'Feeling tired', 'Rash or itching', 'Other'] as const;
const SEVERITY = ['Mild', 'Moderate', 'Severe'] as const;

export default function MedDetail() {
  const p = useLocalSearchParams<{ id: string; date?: string; time?: string; skip?: string }>();
  const med = useStore((s) => s.meds.find((m) => m.id === p.id));
  const doses = useStore((s) => s.doses);
  const voiceLang = useStore((s) => s.settings.voiceLang);
  const myName = useStore((s) => s.profile.name);
  const logDose = useStore((s) => s.logDose);
  const undoDose = useStore((s) => s.undoDose);
  const noteSideEffect = useStore((s) => s.noteSideEffect);

  const [skipFor, setSkipFor] = useState<DoseSlot | null>(() => {
    // opened from a reminder's Skip button
    if (p.skip !== '1') return null;
    const st = useStore.getState();
    const m = st.meds.find((x) => x.id === p.id);
    if (!m) return null;
    return dosesFor([m], st.doses, p.date ?? dateKey()).find((x) => (!p.time || x.time === p.time) && !x.log) ?? null;
  });
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [sideOpen, setSideOpen] = useState(false);
  const [effect, setEffect] = useState<(typeof EFFECTS)[number]>(EFFECTS[0]);
  const [severity, setSeverity] = useState<(typeof SEVERITY)[number]>('Mild');
  const [sideNote, setSideNote] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const date = p.date ?? dateKey();
  const slots = useMemo(() => (med ? dosesFor([med], doses, date) : []), [med, doses, date]);
  const focus = slots.filter((s) => !p.time || s.time === p.time);

  useEffect(() => () => stopSpeaking(), []);

  if (!med) {
    return (
      <Screen top={<BackBar title="Close" />}>
        <T>This medicine was removed.</T>
      </Screen>
    );
  }

  const readAloud = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(reminderScript(med, focus[0]?.time ?? med.times[0], voiceLang, myName), voiceLang, () => setSpeaking(false));
  };

  return (
    <Screen
      padBottom={false}
      top={
        <BackBar
          title="Close"
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Stop reading' : 'Read aloud'} onPress={readAloud} style={styles.speak}>
              <Feather name={speaking ? 'square' : 'volume-2'} size={17} color={C.deep} />
              <T size={13.5} w="sb" color={C.deep}>{speaking ? 'Stop' : 'Read aloud'}</T>
            </Pressable>
          }
        />
      }>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <MedBadge name={med.name} tone="green" size={58} />
        <View style={{ flex: 1 }}>
          <Over>{med.purpose || 'Active medicine'}</Over>
          <T size={27} w="sb" style={{ letterSpacing: -0.6 }}>{med.name}</T>
          <T color={C.muted}>{med.strength} {unitWord(med.form, 1)}</T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.tile}>
          <Feather name="clock" size={20} color={C.green} />
          <T size={12.5} color={C.muted}>Schedule</T>
          <T w="sb">{med.times.map(label).join(', ')}</T>
        </View>
        <View style={styles.tile}>
          <Feather name="calendar" size={20} color={C.green} />
          <T size={12.5} color={C.muted}>Started</T>
          <T w="sb">{shortDate(med.started)}</T>
        </View>
      </View>

      <View style={styles.grid}>
        <Info k="Instructions" v={med.instructions} />
        <Info k="Prescribing provider" v={med.prescriber || 'Not recorded'} />
        <Info k="Refill information" v={supplyText(med)} warn={refillDue(med)} last />
        <Info k="Prescription document" v={med.document || 'None saved'} last />
      </View>

      {focus.length ? (
        focus.map((s) => {
          const [text, kind] = STATUS[s.status];
          return (
            <Card key={s.key} style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T w="sb">{date === dateKey() ? 'Today' : shortDate(date)}, {label(s.time)}</T>
                <Chip label={text} kind={kind} />
              </View>
              {s.log ? (
                <T size={13} color={C.muted}>
                  {s.log.status === 'taken' ? 'Marked taken' : 'Skipped'} by {s.log.by === myName ? 'you' : s.log.by} · {ago(s.log.at)}
                  {s.log.reason ? ` · ${s.log.reason}` : ''}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {s.status === 'taken' ? (
                  <Btn title="Undo taken" kind="ghost" style={{ flex: 1 }} onPress={() => { undoDose(med.id, s.date, s.time); toast('Taken mark removed.'); }} />
                ) : (
                  <Btn title="Mark as taken" icon="check" style={{ flex: 1 }} onPress={() => { logDose(med.id, s.date, s.time, 'taken'); toast(`${med.name} marked as taken.`); }} />
                )}
                {s.status !== 'taken' && s.status !== 'skipped' ? (
                  <Btn title="Skip this dose" kind="ghost" style={{ flex: 1 }} onPress={() => setSkipFor(s)} />
                ) : null}
              </View>
            </Card>
          );
        })
      ) : (
        <Callout>{med.started > date ? `Reminders start ${shortDate(med.started)}.` : 'No doses scheduled for this day.'}</Callout>
      )}

      <View style={{ gap: 10 }}>
        <T size={17} w="sb">At a glance</T>
        <Pictorial med={med} />
        {med.appearance ? (
          <View style={styles.pill}>
            <View style={styles.pillShape}>
              <View style={{ position: 'absolute', left: 6, right: 6, top: 20, height: 2, backgroundColor: '#C3D1CB' }} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="sb">Your pill looks like this</T>
              <T size={13} color={C.muted}>{med.appearance}</T>
            </View>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <T size={17} w="sb">Change history</T>
        {med.history.slice(0, 8).map((h) => (
          <View key={h.id} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, marginTop: 7 }} />
            <View style={{ flex: 1 }}>
              <T w="sb">{h.text}</T>
              <T size={12.5} color={C.muted}>{ago(h.at)} · {h.by === myName ? 'You' : h.by}</T>
            </View>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setSideOpen(true)} style={styles.rowlink}>
        <Feather name="activity" size={20} color={C.green} />
        <View style={{ flex: 1 }}>
          <T w="sb">Log a side effect</T>
          <T size={13} color={C.muted}>Saved to this medicine’s history</T>
        </View>
        <Feather name="chevron-right" size={18} color={C.faint} />
      </Pressable>

      <Callout>Changes to prescribed dosage or clinical instructions require confirmation from an authorized healthcare professional.</Callout>
      {med.personalNote ? <Callout icon="bookmark">{`Your note: ${med.personalNote}`}</Callout> : null}

      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingBottom: 30 }}>
        <Btn title="Edit details" kind="soft" icon="edit-2" onPress={() => router.push({ pathname: '/med-form', params: { id: med.id } })} />
        <Btn title="Done" onPress={() => router.back()} />
      </View>

      <Sheet visible={!!skipFor} onClose={() => setSkipFor(null)} title={`Skip ${med.name}?`} sub="Tell us why. Your care team sees the reason, and you can change it later.">
        <Choice options={REASONS} value={reason} onChange={setReason} />
        <Callout>Skipping does not delete anything. The dose shows as skipped in your history.</Callout>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn title="Cancel" kind="ghost" style={{ flex: 1 }} onPress={() => setSkipFor(null)} />
          <Btn
            title="Skip dose"
            style={{ flex: 1 }}
            onPress={() => {
              if (skipFor) logDose(med.id, skipFor.date, skipFor.time, 'skipped', reason);
              setSkipFor(null);
              toast(`${med.name} skipped. Saved in your history.`);
            }}
          />
        </View>
      </Sheet>

      <Sheet visible={sideOpen} onClose={() => setSideOpen(false)} title="Log a side effect" sub={`${med.name} ${med.strength}`}>
        <T w="sb">What did you notice?</T>
        <Choice options={EFFECTS} value={effect} onChange={setEffect} />
        <T w="sb">How strong?</T>
        <Choice options={SEVERITY} value={severity} onChange={setSeverity} />
        <Field label="Anything else? (optional)" value={sideNote} onChangeText={setSideNote} placeholder="e.g. Started after the morning dose" />
        {severity === 'Severe' || effect === 'Rash or itching' ? (
          <Callout kind="bad">If you have trouble breathing, swelling of the face or throat, or feel very unwell, call 911 now. Otherwise, contact your doctor or pharmacist today.</Callout>
        ) : null}
        <Btn
          title="Save to my history"
          block
          onPress={() => {
            noteSideEffect(med.id, `${effect.toLowerCase()} (${severity.toLowerCase()})${sideNote.trim() ? `: ${sideNote.trim()}` : ''}`);
            setSideOpen(false);
            setSideNote('');
            toast('Side effect saved to your history.');
          }}
        />
      </Sheet>
    </Screen>
  );
}

function Info({ k, v, warn, last }: { k: string; v: string; warn?: boolean; last?: boolean }) {
  return (
    <View style={[styles.cell, last && { borderBottomWidth: 0 }]}>
      <T size={12.5} color={C.muted}>{k}</T>
      <T w="sb" color={warn ? C.orange : C.ink}>{v}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  speak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.tint, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 12 },
  tile: { flex: 1, backgroundColor: C.tint, borderRadius: 14, padding: 12, gap: 4 },
  grid: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, backgroundColor: C.card },
  cell: { width: '46%', flexGrow: 1, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line, gap: 2 },
  pill: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  pillShape: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#9FB3AB', backgroundColor: C.white },
  rowlink: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, backgroundColor: C.card },
});
