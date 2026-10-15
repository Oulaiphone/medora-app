import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Avatar, Btn, Callout, Card, Over, PageTitle, Row, Screen, Section, Segmented, Sheet, T, TextLink, Toggle, TopBar, toast } from '@/components/ui';
import { ago } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { sharingConfigured, useSession } from '@/lib/supabase';
import { pullOwner, refreshCaring, removeMember, updateMemberPerms } from '@/lib/sync';
import { C } from '@/lib/theme';
import type { Member, Perms } from '@/lib/types';

const PERMS: { key: keyof Perms; label: string; sub: string }[] = [
  { key: 'meds', label: 'View medicines and doses', sub: 'See the schedule and what was taken' },
  { key: 'mark', label: 'Mark doses as taken', sub: 'Helpful when they give you your medicine' },
  { key: 'alerts', label: 'Missed-dose alerts', sub: 'Shown in their app when a dose is missed' },
  { key: 'docs', label: 'See documents', sub: 'Scanned labels and prescriptions' },
];

function permText(p: Perms): string {
  const w = [p.meds && 'view medicines', p.meds && p.mark && 'mark doses', p.alerts && 'get missed-dose alerts', p.docs && 'see documents'].filter(Boolean) as string[];
  if (!w.length) return 'No access yet';
  if (w.length === 1) return `Can ${w[0]} only`;
  return `Can ${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}

export default function Care() {
  const mode = useStore((s) => s.settings.mode);
  const members = useStore((s) => s.members);
  const profile = useStore((s) => s.profile);
  const activity = useStore((s) => s.activity);
  const sharing = useStore((s) => s.sharing);
  const caring = useStore((s) => s.caring);
  const session = useSession();
  const [tab, setTab] = useState<'people' | 'activity'>('people');
  const [edit, setEdit] = useState<Member | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        void pullOwner();
        void refreshCaring();
      }
    }, [session]),
  );

  const shareCode = () => {
    if (!sharing.inviteCode) return;
    void Share.share({
      message: `Join my MedOra care circle so you can see my medicines and help with reminders.\n\n1. Install MedOra\n2. Go to Care Team → Join a care circle\n3. Enter code: ${sharing.inviteCode}`,
    });
  };

  const setPerm = async (m: Member, key: keyof Perms, v: boolean) => {
    const perms = { ...m.perms, [key]: v };
    if (key === 'meds' && !v) perms.mark = false;
    setEdit({ ...m, perms });
    try {
      await updateMemberPerms(m.id, perms);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const shared = mode === 'personal' && !!sharing.circleId;

  return (
    <Screen top={<TopBar />}>
      <PageTitle title="My care team" sub="The people supporting your medication routine" />

      <Card tint style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Feather name="lock" size={20} color={C.green} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <T w="sb">You control who can see your information</T>
          <T size={13.5} color={C.soft}>People only have the access you give them. Providers are not automatically connected.</T>
        </View>
      </Card>

      {mode === 'demo' ? (
        <Callout icon="info">These are sample people. Start with your own medicines (Profile → Start over) to invite your real care team.</Callout>
      ) : !shared ? (
        <Card style={{ gap: 10 }}>
          <Over>Share with your care team</Over>
          <T size={19} w="sb">Invite a caregiver</T>
          <T size={14} color={C.soft}>
            Create a care circle and send the invite code. Your caregiver sees your doses live on their own phone and can help, only with the permissions you choose.
          </T>
          {sharingConfigured ? (
            <Btn title={session ? 'Create my care circle' : 'Sign in to start sharing'} icon="users" onPress={() => router.push('/account')} />
          ) : (
            <Callout kind="warn">Sharing needs a free Supabase project. Follow SETUP.md, step 3, then restart the app.</Callout>
          )}
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <Over>Your invite code</Over>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={30} w="b" color={C.deep} style={{ letterSpacing: 6 }} selectable>
              {sharing.inviteCode}
            </T>
            <Btn title="Send" icon="share" size="sm" onPress={shareCode} />
          </View>
          <T size={13} color={C.muted}>
            Caregivers enter this in MedOra under Care Team → Join a care circle.
            {sharing.outbox.length ? ` ${sharing.outbox.length} change${sharing.outbox.length > 1 ? 's' : ''} waiting to sync.` : sharing.lastSync ? ` Synced ${ago(sharing.lastSync).toLowerCase()}.` : ''}
          </T>
        </Card>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'people', label: 'People' },
          { value: 'activity', label: 'Recent activity' },
        ]}
      />

      {tab === 'people' ? (
        <>
          <Section title="Caregivers" action={shared ? <TextLink title="Invite" onPress={shareCode} /> : undefined}>
            {members.length ? (
              members.map((m) => (
                <Card key={m.id} onPress={() => setEdit(m)} label={`${m.name}, change access`} style={styles.person}>
                  <Avatar text={m.name} tone={m.tone} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <T size={16} w="sb">{m.name}</T>
                      {m.emergency ? <T size={11.5} w="b" color={C.orange}>EMERGENCY CONTACT</T> : null}
                    </View>
                    <T size={13} color={C.muted}>{m.relation || 'Caregiver'}</T>
                    {m.contact ? <T size={13} color={C.soft}>{m.contact}</T> : null}
                    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-start', marginTop: 2 }}>
                      <Feather name="lock" size={12} color={C.green} style={{ marginTop: 3 }} />
                      <T size={12.5} w="m" color={C.green} style={{ flex: 1 }}>{permText(m.perms)}</T>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.faint} />
                </Card>
              ))
            ) : (
              <T size={14} color={C.muted}>{shared ? 'No one has joined yet. Send your invite code.' : 'No caregivers yet.'}</T>
            )}
          </Section>

          <Section title="Healthcare providers" action={<TextLink title="Add" onPress={() => router.push('/profile-edit')} />}>
            {profile.providers.length ? (
              profile.providers.map((p) => (
                <Card key={p.id} onPress={() => router.push({ pathname: '/share', params: { to: p.name } })} label={`Share a summary with ${p.name}`} style={styles.person}>
                  <Avatar text={p.name.replace(/^Dr\.?\s*/, '')} tone="sage" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={16} w="sb">{p.name}</T>
                    <T size={13} color={C.muted}>{p.role}</T>
                    <T size={13} color={C.soft}>{p.org}</T>
                    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 2 }}>
                      <Feather name="lock" size={12} color={C.green} />
                      <T size={12.5} w="m" color={C.green}>Not connected · tap to share a summary</T>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.faint} />
                </Card>
              ))
            ) : (
              <T size={14} color={C.muted}>Add your doctor and pharmacist in Profile so you can send them a summary.</T>
            )}
          </Section>

          <Section title="People I care for" action={sharingConfigured ? <TextLink title="Join" onPress={() => router.push('/join')} /> : undefined}>
            {caring.length ? (
              caring.map((c) => (
                <Card key={c.circleId} onPress={() => router.push({ pathname: '/caring/[id]', params: { id: c.circleId } })} label={`Open ${c.patientName}`} style={styles.person}>
                  <Avatar text={c.patientName} tone="lav" />
                  <View style={{ flex: 1 }}>
                    <T size={16} w="sb">{c.patientName}</T>
                    <T size={13} color={C.muted}>See today’s doses and help out</T>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.faint} />
                </Card>
              ))
            ) : (
              <T size={14} color={C.muted}>
                {sharingConfigured ? 'If someone sends you an invite code, tap Join to help with their medicines.' : 'Caregiver view turns on with sharing (SETUP.md, step 3).'}
              </T>
            )}
          </Section>
        </>
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          <T size={17} w="sb" style={{ paddingTop: 8 }}>Recent care team activity</T>
          {activity.slice(0, 25).map((a, i, arr) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 11 }}>
              <View style={{ alignItems: 'center' }}>
                <Avatar text={a.who === profile.name ? profile.name || 'You' : a.who} size={34} tone={a.who === profile.name ? 'green' : 'peach'} />
                {i < arr.length - 1 ? <View style={{ width: 1.5, flex: 1, backgroundColor: C.line, marginTop: 4 }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <T size={14.5}>
                  <T size={14.5} w="sb">{a.who === profile.name ? 'You' : a.who}</T> {a.text}
                </T>
                <T size={12.5} color={C.muted}>{ago(a.at)}</T>
              </View>
            </View>
          ))}
          {!activity.length ? <T size={14} color={C.muted} style={{ paddingVertical: 12 }}>Nothing yet.</T> : null}
        </Card>
      )}

      <Card dark style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="users" size={19} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={17} w="sb" color={C.white}>Care coordination</T>
            <T size={13.5} color="#D7ECE3">See who changed medication information and when. Shared changes remain visible in your history.</T>
          </View>
        </View>
        <Pressable onPress={() => setTab(tab === 'people' ? 'activity' : 'people')} style={styles.lightBtn}>
          <Feather name={tab === 'people' ? 'clock' : 'users'} size={17} color={C.deep} />
          <T w="sb" color={C.deep}>{tab === 'people' ? 'View activity' : 'View people'}</T>
        </Pressable>
      </Card>

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''} sub="Choose what this person can see and do.">
        {edit ? (
          <>
            <View>
              {PERMS.map((p, i) => (
                <Row
                  key={p.key}
                  title={p.label}
                  sub={p.sub}
                  last={i === PERMS.length - 1}
                  right={<Toggle label={p.label} value={edit.perms[p.key]} onChange={(v) => void setPerm(edit, p.key, v)} />}
                />
              ))}
            </View>
            {edit.source === 'sample' ? <Callout icon="info">Sample person: changes stay on this phone.</Callout> : null}
            <Btn
              title="Remove from care team"
              kind="danger"
              icon="user-x"
              block
              onPress={() => {
                const m = edit;
                setEdit(null);
                void removeMember(m.id).then(() => toast(`${m.name} removed.`)).catch((e: Error) => toast(e.message));
              }}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lightBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF6F3', borderRadius: 14, paddingVertical: 13 },
});
