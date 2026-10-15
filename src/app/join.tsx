import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { BackBar, Btn, Callout, Card, Choice, Field, Screen, T, toast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { sharingConfigured, useSession } from '@/lib/supabase';
import { joinCircle } from '@/lib/sync';
import { C } from '@/lib/theme';

const RELATIONS = ['Daughter', 'Son', 'Spouse', 'Parent', 'Friend', 'Neighbor', 'Nurse', 'Other'] as const;

export default function Join() {
  const session = useSession();
  const myDefault = useStore((s) => (s.settings.mode === 'personal' ? s.profile.name : ''));
  const [code, setCode] = useState('');
  const [name, setName] = useState(myDefault);
  const [rel, setRel] = useState<(typeof RELATIONS)[number]>('Daughter');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await joinCircle(code, name, rel);
      toast(`You joined ${r.patient_name || 'the'} care circle.`);
      router.replace({ pathname: '/caring/[id]', params: { id: r.circle_id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen top={<BackBar />} padBottom={false}>
        <View style={{ gap: 2 }}>
          <T size={27} w="sb">Join a care circle</T>
          <T color={C.muted}>Enter the code someone sent you to help with their medicines.</T>
        </View>
        {!sharingConfigured ? (
          <Callout kind="warn">Sharing is not set up in this copy of MedOra yet (SETUP.md, step 3).</Callout>
        ) : !session ? (
          <Card style={{ gap: 10 }}>
            <T w="sb">Sign in first</T>
            <T size={14} color={C.soft}>Caregivers need a free account so the patient knows who has access.</T>
            <Btn title="Sign in or create account" onPress={() => router.push('/account')} />
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Field label="Invite code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={6} placeholder="e.g. K7M2QX" />
            <Field label="Your name, as they will see it" value={name} onChangeText={setName} autoCapitalize="words" placeholder="e.g. Sarah Collins" />
            <View style={{ gap: 8 }}>
              <T size={13} w="sb" color={C.soft}>You are their…</T>
              <Choice options={RELATIONS} value={rel} onChange={setRel} />
            </View>
            <Btn title="Join" icon="user-plus" size="xl" block loading={busy} disabled={code.trim().length < 6 || !name.trim()} onPress={() => void join()} />
          </Card>
        )}
        {err ? <Callout kind="bad">{err}</Callout> : null}
        <Callout icon="info">The patient chooses what you can see and do. You start with view-only access.</Callout>
      </Screen>
    </KeyboardAvoidingView>
  );
}
