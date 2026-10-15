import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { label, slotOf } from '@/lib/dates';
import { FOOD_LABEL, refillDue, supplyText, unitWord, type DoseSlot, type SlotStatus } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Medication } from '@/lib/types';

import { Chip, Icon, MedBadge, T, type ChipKind } from './ui';

export const STATUS: Record<SlotStatus, [string, ChipKind]> = {
  taken: ['Taken', 'ok'],
  skipped: ['Skipped', 'sk'],
  missed: ['Missed', 'bad'],
  due: ['Due now', 'warn'],
  upcoming: ['Upcoming', 'up'],
};

export const SLOT_COLOR = { Morning: C.amberdot, Afternoon: C.afternoon, Evening: C.evening, Night: C.deep } as const;

export function CheckBox({ status, onPress, name }: { status: SlotStatus; onPress?: () => void; name: string }) {
  const done = status === 'taken';
  const skipped = status === 'skipped';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? `Undo: ${name} taken` : `Mark ${name} as taken`}
      onPress={onPress}
      hitSlop={6}
      style={[styles.ck, done && { backgroundColor: C.green, borderColor: C.green }, skipped && { backgroundColor: C.skip, borderColor: C.skip }]}>
      {done ? <Feather name="check" size={17} color={C.white} /> : skipped ? <Feather name="minus" size={17} color={C.soft} /> : null}
    </Pressable>
  );
}

export function DoseRow({ slot, onToggle }: { slot: DoseSlot; onToggle: () => void }) {
  const [text, kind] = STATUS[slot.status];
  const { med } = slot;
  const me = useStore((s) => s.profile.name || 'You');
  return (
    <View style={[styles.row, slot.status === 'taken' && { backgroundColor: '#FBFCFB' }]}>
      <CheckBox status={slot.status} onPress={onToggle} name={med.name} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${med.name} details`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        onPress={() => router.push({ pathname: '/med/[id]', params: { id: med.id, date: slot.date, time: slot.time } })}>
        <View style={{ flex: 1, gap: 3 }}>
          <T size={16} w="sb">
            {med.name}
          </T>
          <Chip label={slot.log && slot.log.by !== me ? `${text} · ${slot.log.by.split(' ')[0]}` : text} kind={kind} />
          <T size={13.5} color={C.soft}>
            {med.strength} {unitWord(med.form, 1)} · {label(slot.time)}
          </T>
          <T size={12.5} color={C.muted}>
            {med.instructions}
            {slot.log?.reason ? ` · ${slot.log.reason}` : ''}
          </T>
        </View>
        <Feather name="chevron-right" size={18} color={C.faint} />
      </Pressable>
    </View>
  );
}

export function MedCard({ med }: { med: Medication }) {
  const slot = slotOf(med.times[0] ?? '08:00');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${med.name} ${med.strength}`}
      onPress={() => router.push({ pathname: '/med/[id]', params: { id: med.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <MedBadge name={med.name} tone="green" />
      <View style={{ flex: 1, gap: 3 }}>
        <T size={16.5} w="sb">
          {med.name}
        </T>
        <T size={13.5} color={C.soft}>
          {med.strength} {unitWord(med.form, 1)} · {med.times.length > 1 ? `${med.times.length}× daily` : slot} at {med.times.map(label).join(', ')}
        </T>
        <T size={12.5} color={C.muted}>
          {med.instructions}
        </T>
        {med.prescriber ? (
          <View style={styles.meta}>
            <Feather name="user" size={13} color={C.muted} />
            <T size={12.5} color={C.muted}>
              {med.prescriber}
            </T>
          </View>
        ) : null}
        <View style={styles.meta}>
          <Feather name="calendar" size={13} color={refillDue(med) ? C.orange : C.muted} />
          <T size={12.5} w={refillDue(med) ? 'sb' : 'r'} color={refillDue(med) ? C.orange : C.muted}>
            {supplyText(med)}
          </T>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={C.faint} style={{ marginTop: 12 }} />
    </Pressable>
  );
}

/** Instructions as pictures: how many, when, food. */
export function Pictorial({ med }: { med: Medication }) {
  const first = med.times[0] ?? '08:00';
  const slot = slotOf(first);
  const when = med.times.length > 1 ? `${med.times.length} times a day` : slot === 'Morning' ? 'Every morning' : slot === 'Afternoon' ? 'Every afternoon' : slot === 'Evening' ? 'Every evening' : 'At night';
  const timeIcon = slot === 'Morning' ? 'sunrise' : slot === 'Afternoon' ? 'sun' : slot === 'Evening' ? 'sunset' : 'moon';
  const tiles: { icon: Parameters<typeof Icon>[0]['name']; text: string }[] = [
    { icon: 'pill', text: `${med.dose === 0.5 ? '½' : med.dose} ${unitWord(med.form, med.dose)}` },
    { icon: timeIcon, text: when },
    { icon: med.food === 'none' ? 'droplet' : med.food === 'empty' ? 'slash' : 'food', text: med.food === 'none' ? 'With water' : FOOD_LABEL[med.food] },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {tiles.map((t) => (
        <View key={t.text} style={styles.picto}>
          <Icon name={t.icon} size={28} color={C.green} />
          <T size={13} w="sb" center>
            {t.text}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ck: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: '#B7C8C1', backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, backgroundColor: C.card },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picto: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 8 },
});
