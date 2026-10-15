import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { BackBar, Btn, Callout, Card, Field, Over, Screen, Segmented, T, toast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { sharingConfigured, useSession } from '@/lib/supabase';
import { afterSignIn, createCircle, restoreFromCloud, signIn, signOut, signUp } from '@/lib/sync';
import { C } from '@/lib/theme';

export default function Account() {
  const session = useSession();
  const mode = useStore((s) => s.settings.mode);
  const sharing = useStore((s) => s.sharing);
  const [tab, setTab] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (tab === 'up') {
        const r = await signUp(email, pw);
        if (r.needsConfirm) setMsg('Check your email and tap the confirmation link, then come back and sign in.');
        else {
          await afterSignIn();
          toast('Account created.');
        }
      } else {
        await signIn(email, pw);
        toast('Signed in.');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const circle = async () => {
    setBusy(true);
    try {
      const code = await createCircle();
      toast(`Care circle created. Your code is ${code}.`);
      router.navigate('/care');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not create the care circle.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen top={<BackBar />} padBottom={false}>
        <View style={{ gap: 2 }}>
          <T size={27} w="sb">Account & sharing</T>
          <T color={C.muted}>An account is only needed to share with caregivers. Everything else works without one.</T>
        </View>

        {!sharingConfigured ? (
          <Callout kind="warn">Sharing is not set up in this copy of MedOra yet. Follow SETUP.md, step 3, to connect a free Supabase project, then restart the app.</Callout>
        ) : session === undefined ? null : session ? (
          <>
            <Card style={{ gap: 6 }}>
              <Over>Signed in</Over>
              <T size={17} w="sb">{session.user.email}</T>
            </Card>
            {mode === 'demo' ? (
              <Callout icon="info">You’re exploring sample data. To share your own routine, go to Profile → Leave the sample. You can still join someone else’s care circle.</Callout>
            ) : sharing.circleId ? (
              <Card style={{ gap: 8 }}>
                <Over>Backed up · your care circle</Over>
                <T size={28} w="b" color={C.deep} style={{ letterSpacing: 6 }} selectable>{sharing.inviteCode}</T>
                <T size={13.5} color={C.muted}>Send this code to the people you want in your care team.</T>
                <Btn title="Go to Care Team" kind="soft" onPress={() => router.navigate('/care')} />
                <Btn
                  title="Restore my schedule on this phone"
                  kind="ghost"
                  icon="refresh-ccw"
                  loading={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      const n = await restoreFromCloud();
                      toast(n ? `Restored ${n} medicine${n === 1 ? '' : 's'}.` : 'Nothing to restore yet.');
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : 'Could not restore.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </Card>
            ) : (
              <Card style={{ gap: 10 }}>
                <T size={17} w="sb">Create your care circle</T>
                <T size={14} color={C.soft}>Your medicines and dose history are copied to your private circle. Only people you invite can see them, and only with the permissions you set. It also backs up your schedule: if you replace or lose your phone, sign in on the new one and everything comes back.</T>
                <Btn title="Create my care circle" icon="users" loading={busy} onPress={() => void circle()} />
              </Card>
            )}
            <Btn title="Join someone else’s care circle" kind="ghost" icon="user-plus" block onPress={() => router.push('/join')} />
            <Btn
              title="Sign out"
              kind="danger"
              icon="log-out"
              block
              onPress={() => {
                void signOut().then(() => toast('Signed out. Your medicines stay on this phone.'));
              }}
            />
          </>
        ) : (
          <Card style={{ gap: 14 }}>
            <Segmented
              value={tab}
              onChange={(v) => {
                setTab(v);
                setMsg(null);
              }}
              options={[
                { value: 'up', label: 'Create account' },
                { value: 'in', label: 'Sign in' },
              ]}
            />
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete={tab === 'up' ? 'new-password' : 'current-password'} hint={tab === 'up' ? 'At least 6 characters' : undefined} />
            <Btn title={tab === 'up' ? 'Create account' : 'Sign in'} size="xl" block loading={busy} disabled={!email.includes('@') || pw.length < 6} onPress={() => void go()} />
          </Card>
        )}
        {msg ? <Callout kind="warn">{msg}</Callout> : null}
        <View style={{ height: 30 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
