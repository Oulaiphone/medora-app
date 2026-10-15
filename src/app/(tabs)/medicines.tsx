import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { MedCard } from '@/components/meds';
import { Btn, Card, Choice, PageTitle, Screen, T, TopBar, useScale } from '@/components/ui';
import { slotOf } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const FILTERS = ['All', 'Morning', 'Afternoon', 'Evening', 'Night'] as const;
type Filter = (typeof FILTERS)[number];

export default function Medicines() {
  const meds = useStore((s) => s.meds);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const k = useScale();

  const present = useMemo(() => FILTERS.filter((f) => f === 'All' || meds.some((m) => m.times.some((t) => slotOf(t) === f))), [meds]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return meds
      .filter((m) => m.active)
      .filter((m) => filter === 'All' || m.times.some((t) => slotOf(t) === filter))
      .filter((m) => !needle || `${m.name} ${m.purpose ?? ''} ${m.prescriber}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? '') || a.name.localeCompare(b.name));
  }, [meds, q, filter]);
  const active = meds.filter((m) => m.active).length;

  return (
    <Screen top={<TopBar />}>
      <PageTitle title="My medicines" sub={`${active} active medicine${active === 1 ? '' : 's'}`} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13, backgroundColor: C.card }}>
          <Feather name="search" size={18} color={C.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search medicines"
            placeholderTextColor={C.faint}
            accessibilityLabel="Search medicines"
            style={{ flex: 1, paddingVertical: 12, fontFamily: F.r, fontSize: 15.5 * k, color: C.ink }}
          />
        </View>
        <Btn title="Add" icon="plus" onPress={() => router.push('/med-form')} />
      </View>
      {present.length > 2 ? <Choice options={present} value={filter} onChange={setFilter} /> : null}
      {list.map((m) => (
        <MedCard key={m.id} med={m} />
      ))}
      {!list.length ? (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
          <Feather name="package" size={28} color={C.faint} />
          <T w="sb">{meds.length ? 'No medicines match' : 'No medicines yet'}</T>
          <T size={14} color={C.muted} center>
            {meds.length ? 'Try a different search or filter.' : 'Scan a label or add one yourself.'}
          </T>
          {!meds.length ? <Btn title="Scan a label" icon="scan" size="sm" onPress={() => router.navigate('/scan')} /> : null}
        </Card>
      ) : null}
      <Card tint style={{ flexDirection: 'row', gap: 12 }}>
        <Feather name="shield" size={20} color={C.green} />
        <View style={{ flex: 1 }}>
          <T w="sb">Medication changes stay in your history</T>
          <T size={13.5} color={C.muted}>
            Changes that need clinical judgment, like a new dose, should be confirmed by your doctor or pharmacist.
          </T>
        </View>
      </Card>
    </Screen>
  );
}
