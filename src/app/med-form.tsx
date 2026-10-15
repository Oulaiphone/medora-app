import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { BackBar, Btn, Callout, Card, Choice, Field, Screen, T, TextLink, toast } from '@/components/ui';
import { dateKey, fromMin, label, toMin } from '@/lib/dates';
import { allergyMatches } from '@/lib/safety';
import { FOOD_LABEL } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Food, Medication } from '@/lib/types';

const FORMS = ['tablet', 'capsule', 'softgel', 'puff', 'drop', 'ml', 'patch'] as const;
const DOSES = ['0.5', '1', '2', '3', '4'] as const;
const FOODS: readonly Food[] = ['none', 'with', 'after', 'before', 'empty'];
const REMIND = ['0', '10', '30'] as const;
const PRESETS = ['08:00', '13:00', '19:00', '21:00'];

export default function MedForm() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const existing = useStore((s) => (id ? s.meds.find((m) => m.id === id) : undefined));
  const draft = useStore((s) => (from === 'scan' ? s.scanDraft : null));
  const allergies = useStore((s) => s.profile.allergies);
  const addMed = useStore((s) => s.addMed);
  const updateMed = useStore((s) => s.updateMed);
  const removeMed = useStore((s) => s.removeMed);
  const setScanDraft = useStore((s) => s.setScanDraft);

  const src = existing ?? draft;
  const [name, setName] = useState(src?.name ?? '');
  const [strength, setStrength] = useState(src?.strength ?? '');
  const [form, setForm] = useState<string>(src?.form ?? 'tablet');
  const [dose, setDose] = useState(String(src?.dose ?? 1));
  const [times, setTimes] = useState<string[]>(src?.times?.length ? src.times : ['08:00']);
  const [instructions, setInstructions] = useState(src?.instructions ?? '');
  const [food, setFood] = useState<Food>(src?.food ?? 'none');
  const [prescriber, setPrescriber] = useState(src?.prescriber ?? '');
  const [pharmacy, setPharmacy] = useState(src?.pharmacy ?? '');
  const [purpose, setPurpose] = useState(existing?.purpose ?? '');
  const [appearance, setAppearance] = useState(existing?.appearance ?? '');
  const [supply, setSupply] = useState(src?.supply != null ? String(src.supply) : '');
  const [remind, setRemind] = useState(String(existing?.remindOffset ?? 0) as (typeof REMIND)[number]);
  const [note, setNote] = useState(existing?.personalNote ?? '');
  const [showRaw, setShowRaw] = useState(false);

  const allergyHits = useMemo(() => (name.trim().length > 2 ? allergyMatches(name, allergies) : []), [name, allergies]);
  const canSave = name.trim().length > 0 && times.length > 0;

  const shift = (i: number, delta: number) => setTimes((t) => t.map((x, j) => (j === i ? fromMin(toMin(x) + delta) : x)));
  const setTime = (i: number, v: string) => setTimes((t) => t.map((x, j) => (j === i ? v : x)));

  const save = () => {
    if (!canSave) return;
    // pick up a food rule from the instructions if none was chosen
    const ins = instructions.toLowerCase();
    const foodRule: Food =
      food !== 'none' ? food : /empty stomach/.test(ins) ? 'empty' : /before (food|meal|eating|breakfast)/.test(ins) ? 'before' : /after (food|meal|eating|breakfast|lunch|dinner)/.test(ins) ? 'after' : /with (food|a meal|meals|breakfast|lunch|dinner|milk)/.test(ins) ? 'with' : 'none';
    const fields = {
      name: name.trim(),
      strength: strength.trim(),
      form,
      dose: Number(dose) || 1,
      times: Array.from(new Set(times)).sort(),
      instructions: instructions.trim() || (food === 'none' ? 'Take as directed' : `Take ${FOOD_LABEL[food].toLowerCase()}`),
      food: foodRule,
      prescriber: prescriber.trim(),
      pharmacy: pharmacy.trim() || undefined,
      purpose: purpose.trim() || undefined,
      appearance: appearance.trim() || undefined,
      supply: supply.trim() ? Math.max(0, Math.round(Number(supply.replace(/[^\d.]/g, '')) || 0)) : null,
      remindOffset: Number(remind) as Medication['remindOffset'],
      personalNote: note.trim() || undefined,
    };
    if (existing) {
      const changes: string[] = [];
      if (existing.strength !== fields.strength) changes.push(`strength ${existing.strength || '—'} → ${fields.strength || '—'}`);
      if (existing.dose !== fields.dose) changes.push(`dose ${existing.dose} → ${fields.dose}`);
      if (existing.times.join() !== fields.times.join()) changes.push(`time ${existing.times.map(label).join(', ')} → ${fields.times.map(label).join(', ')}`);
      if (existing.instructions !== fields.instructions) changes.push('instructions');
      if (existing.remindOffset !== fields.remindOffset) changes.push('reminder time');
      if ((existing.personalNote ?? '') !== (fields.personalNote ?? '')) changes.push('personal note');
      if (existing.supply !== fields.supply) changes.push('supply');
      updateMed(existing.id, fields, changes.length ? `Changed ${changes.join(', ')}` : 'Details reviewed');
      toast('Saved.');
      router.back();
      return;
    }
    const med = addMed(
      { ...fields, started: dateKey(), refillDays: 7, document: draft?.document },
      draft ? `Medicine added from a ${draft.document.startsWith('Sample') ? 'sample label' : 'scanned label'}` : 'Medicine added',
    );
    setScanDraft(null);
    toast(`${med.name} added.`);
    router.replace({ pathname: '/med/[id]', params: { id: med.id } });
  };

  const remove = () => {
    if (!existing) return;
    const go = () => {
      removeMed(existing.id);
      toast(`${existing.name} removed.`);
      router.dismissAll();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Remove ${existing.name}?`, 'Its reminders stop. Past doses stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen top={<BackBar title="Cancel" />} padBottom={false}>
        <View style={{ gap: 2 }}>
          <T size={26} w="sb">
            {existing ? `Edit ${existing.name}` : draft ? 'Check what we found' : 'Add a medicine'}
          </T>
          <T color={C.muted}>{draft ? 'Read from your label. Fix anything that looks wrong, then save.' : existing ? 'Update the details below.' : 'Type the details from the box, bottle or prescription.'}</T>
        </View>

        {draft?.warnings.map((w) => (
          <Callout key={w} kind={w.startsWith('Allergy') ? 'bad' : 'warn'}>
            {w}
          </Callout>
        ))}
        {!draft && allergyHits.length ? (
          <Callout kind="bad">{`Allergy alert: ${name} may be related to your recorded allergy (${allergyHits.join(', ')}). Check with your pharmacist.`}</Callout>
        ) : null}
        {existing ? (
          <Callout>Changes to dose or times should match what your doctor prescribed. Every change is saved in this medicine’s history.</Callout>
        ) : null}

        <Card style={{ gap: 14 }}>
          <Field label="Medicine name" value={name} onChangeText={setName} placeholder="e.g. Lisinopril" autoCapitalize="words" />
          <Field label="Strength" value={strength} onChangeText={setStrength} placeholder="e.g. 10 mg" />
          <View style={{ gap: 8 }}>
            <T size={13} w="sb" color={C.soft}>Form</T>
            <Choice options={FORMS} value={form as (typeof FORMS)[number]} onChange={setForm} />
          </View>
          <View style={{ gap: 8 }}>
            <T size={13} w="sb" color={C.soft}>How many each time</T>
            <Choice options={DOSES} value={(DOSES as readonly string[]).includes(dose) ? (dose as (typeof DOSES)[number]) : '1'} onChange={setDose} labels={{ '0.5': '½' }} />
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <T w="sb">When to take it</T>
          {times.map((t, i) => (
            <View key={`${i}-${t}`} style={{ gap: 8, paddingBottom: 10, borderBottomWidth: i === times.length - 1 ? 0 : 1, borderBottomColor: C.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Step icon="minus" label="15 minutes earlier" onPress={() => shift(i, -15)} />
                <T size={22} w="sb" style={{ flex: 1, textAlign: 'center' }}>
                  {label(t)}
                </T>
                <Step icon="plus" label="15 minutes later" onPress={() => shift(i, 15)} />
                {times.length > 1 ? <Step icon="trash-2" label="Remove this time" onPress={() => setTimes((x) => x.filter((_, j) => j !== i))} /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <Pressable key={p} onPress={() => setTime(i, p)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, backgroundColor: p === t ? C.green : C.bg }}>
                    <T size={12.5} w="sb" color={p === t ? C.white : C.soft}>{label(p)}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {times.length < 6 ? <TextLink title="Add another time" onPress={() => setTimes((t) => [...t, fromMin(toMin(t[t.length - 1] ?? '08:00') + 360)])} /> : null}
          <View style={{ gap: 8 }}>
            <T size={13} w="sb" color={C.soft}>Remind me</T>
            <Choice options={REMIND} value={remind} onChange={setRemind} labels={{ '0': 'At dose time', '10': '10 min before', '30': '30 min before' }} />
          </View>
        </Card>

        <Card style={{ gap: 14 }}>
          <Field label="Instructions" value={instructions} onChangeText={setInstructions} placeholder="e.g. Take with breakfast" />
          <View style={{ gap: 8 }}>
            <T size={13} w="sb" color={C.soft}>Food</T>
            <Choice options={FOODS} value={food} onChange={setFood} labels={{ none: 'No rule', with: 'With food', after: 'After food', before: 'Before food', empty: 'Empty stomach' }} />
          </View>
          <Field label="Prescribed by" value={prescriber} onChangeText={setPrescriber} placeholder="e.g. Dr. Elena Chen" autoCapitalize="words" />
          <Field label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} placeholder="Optional" autoCapitalize="words" />
          <Field label="Pills or doses on hand" value={supply} onChangeText={setSupply} placeholder="Optional, for refill reminders" keyboardType="number-pad" hint="MedOra counts down as you take doses and warns you a week before you run out." />
          <Field label="What it’s for" value={purpose} onChangeText={setPurpose} placeholder="Optional, e.g. Blood pressure" />
          <Field label="What it looks like" value={appearance} onChangeText={setAppearance} placeholder="Optional, e.g. Round · white · marked CV10" />
          <Field label="Personal note" value={note} onChangeText={setNote} placeholder="Optional, e.g. Kept in the kitchen cabinet" />
        </Card>

        {draft?.rawText ? (
          <View style={{ gap: 8 }}>
            <TextLink title={showRaw ? 'Hide what the scanner read' : 'See what the scanner read'} onPress={() => setShowRaw((v) => !v)} />
            {showRaw ? (
              <Card style={{ backgroundColor: C.bg }}>
                <T size={13} color={C.soft} selectable>
                  {draft.rawText}
                </T>
              </Card>
            ) : null}
          </View>
        ) : null}

        <Btn title={existing ? 'Save changes' : 'Save medicine'} icon="check" size="xl" block disabled={!canSave} onPress={save} />
        {existing ? <Btn title="Remove this medicine" kind="danger" icon="trash-2" block onPress={remove} /> : null}
        <View style={{ height: 30 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Step({ icon, onPress, label: lab }: { icon: 'minus' | 'plus' | 'trash-2'; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={lab} onPress={onPress} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Feather name={icon} size={18} color={icon === 'trash-2' ? C.red : C.deep} />
    </Pressable>
  );
}
