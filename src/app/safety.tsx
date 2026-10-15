import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BackBar, Btn, Callout, Card, Chip, Field, Row, Screen, T, toast } from '@/components/ui';
import { allergyMatches } from '@/lib/safety';
import { refillDue, supplyText } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Safety() {
  const profile = useStore((s) => s.profile);
  const meds = useStore((s) => s.meds);
  const setProfile = useStore((s) => s.setProfile);
  const [add, setAdd] = useState('');

  const active = meds.filter((m) => m.active);
  const flagged = active.map((m) => ({ m, hits: allergyMatches(m.name, profile.allergies) })).filter((x) => x.hits.length);
  const refills = active.filter(refillDue);

  const addAllergy = () => {
    const v = add.trim();
    if (!v) return;
    if (profile.allergies.some((a) => a.toLowerCase() === v.toLowerCase())) return setAdd('');
    setProfile({ allergies: [...profile.allergies, v] });
    setAdd('');
    toast(`${v} added to your allergies.`);
  };

  return (
    <Screen top={<BackBar />} padBottom={false}>
      <View style={{ gap: 2 }}>
        <T size={27} w="sb">Medication safety</T>
        <T color={C.muted}>Based on your profile and medicines</T>
      </View>

      <Card style={{ gap: 12 }}>
        <T size={17} w="sb">Allergies</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {profile.allergies.map((a) => (
            <Pressable
              key={a}
              accessibilityLabel={`Remove ${a}`}
              onPress={() => setProfile({ allergies: profile.allergies.filter((x) => x !== a) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orangebg, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 12 }}>
              <T w="sb" color={C.orange}>{a}</T>
              <Feather name="x" size={14} color={C.orange} />
            </Pressable>
          ))}
          {!profile.allergies.length ? <T color={C.muted}>None recorded</T> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Add an allergy" value={add} onChangeText={setAdd} placeholder="e.g. Penicillin" onSubmitEditing={addAllergy} returnKeyType="done" />
          </View>
          <Btn title="Add" onPress={addAllergy} disabled={!add.trim()} />
        </View>
        <T size={13} color={C.muted}>MedOra checks every medicine you add or scan against this list and warns you about a likely match.</T>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={17} w="sb">Your current medicines</T>
          <Chip label={flagged.length ? `${flagged.length} to check` : 'No allergy match'} kind={flagged.length ? 'bad' : 'ok'} />
        </View>
        {flagged.length ? (
          flagged.map(({ m, hits }) => (
            <Callout key={m.id} kind="bad">{`${m.name} may be related to your allergy (${hits.join(', ')}). Talk to your pharmacist before your next dose.`}</Callout>
          ))
        ) : (
          <T size={14} color={C.soft}>
            None of your {active.length} medicine{active.length === 1 ? '' : 's'} match the allergies in your profile.
          </T>
        )}
      </Card>

      {refills.length ? (
        <Card style={{ paddingVertical: 6 }}>
          <T size={17} w="sb" style={{ paddingTop: 8 }}>Running low</T>
          {refills.map((m, i) => (
            <Row key={m.id} icon="calendar" iconKind="orange" title={m.name} sub={`${supplyText(m)}${m.pharmacy ? ` · ${m.pharmacy}` : ''}`} last={i === refills.length - 1} onPress={() => router.push({ pathname: '/med/[id]', params: { id: m.id } })} />
          ))}
        </Card>
      ) : null}

      <Callout kind="warn">This is a simple name check, not a full drug-interaction review. Always check with your doctor or pharmacist before starting or stopping a medicine.</Callout>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
