import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, RefreshControl, View } from 'react-native';

import { STATUS } from '@/components/meds';
import { Avatar, BackBar, Btn, Callout, Card, Chip, Over, Screen, T, toast } from '@/components/ui';
import { ago, label, longDay } from '@/lib/dates';
import { dosesFor } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { caregiverMark, caregiverNudge, leaveCircle, loadCaring, watchCaring, type CaringView } from '@/lib/sync';
import { C } from '@/lib/theme';

export default function Caring() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.caring.find((c) => c.circleId === id));
  const [view, setView] = useState<CaringView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchView = useCallback(
    () =>
      loadCaring(id).then(
        (v) => {
          setView(v);
          setErr(null);
        },
        (e: unknown) => setErr(e instanceof Error ? e.message : 'Could not load.'),
      ),
    [id],
  );
  const load = useCallback(async () => {
    setLoading(true);
    await fetchView();
    setLoading(false);
  }, [fetchView]);

  useEffect(() => {
    void fetchView();
    return watchCaring(id, () => void fetchView());
  }, [id, fetchView]);

  const slots = useMemo(() => (view ? dosesFor(view.meds, view.doses) : []), [view]);
  const first = (view?.patientName || me?.patientName || 'them').split(' ')[0];
  const myName = me?.myName || 'Caregiver';

  const leave = () => {
    const go = async () => {
      await leaveCircle(id);
      toast('You left the care circle.');
      router.back();
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(`Leave ${first}’s care circle?`, 'You will stop seeing their medicines.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <Screen top={<BackBar title="Care Team" />} padBottom={false} refresh={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Avatar text={view?.patientName || me?.patientName || '?'} tone="lav" size={56} />
        <View style={{ flex: 1 }}>
          <Over>Caregiver view</Over>
          <T size={25} w="sb">{view?.patientName || me?.patientName}</T>
          <T color={C.muted}>{longDay()}</T>
        </View>
      </View>

      {err ? <Callout kind="bad">{err}</Callout> : null}
      {!view && !err ? <ActivityIndicator color={C.green} /> : null}

      {view ? (
        <>
          {!view.perms.meds ? (
            <Callout icon="lock">{`${first} hasn’t shared medicines with you yet. They can change this in their Care Team.`}</Callout>
          ) : (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={18} w="sb">{first}’s medicines today</T>
                <Chip label={`${slots.filter((s) => s.status === 'taken').length} of ${slots.length} taken`} />
              </View>
              {slots.map((s) => {
                const [text, kind] = STATUS[s.status];
                const open = s.status === 'due' || s.status === 'missed' || s.status === 'upcoming';
                return (
                  <View key={s.key} style={{ gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T w="sb">{s.med.name} <T size={13} color={C.muted}>{s.med.strength}</T></T>
                        <T size={13} color={C.muted}>
                          {label(s.time)}
                          {s.log ? ` · by ${s.log.by}` : ''}
                          {s.log?.reason ? ` · ${s.log.reason}` : ''}
                        </T>
                      </View>
                      <Chip label={text} kind={kind} />
                    </View>
                    {open && s.status !== 'upcoming' ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Btn
                          title="Send a reminder"
                          icon="bell"
                          size="sm"
                          kind="soft"
                          loading={busyKey === `n${s.key}`}
                          onPress={async () => {
                            setBusyKey(`n${s.key}`);
                            try {
                              await caregiverNudge(id, s.med, label(s.time), myName);
                              toast(`${first} will see your reminder in MedOra.`);
                            } catch (e) {
                              toast(e instanceof Error ? e.message : 'Could not send.');
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                        />
                        {view.perms.mark ? (
                          <Btn
                            title="Mark taken"
                            icon="check"
                            size="sm"
                            loading={busyKey === `m${s.key}`}
                            onPress={async () => {
                              setBusyKey(`m${s.key}`);
                              try {
                                await caregiverMark(id, s.med, s.date, s.time, 'taken', myName);
                                toast(`${s.med.name} marked as taken.`);
                                await load();
                              } catch (e) {
                                toast(e instanceof Error ? e.message : 'Could not save.');
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {!slots.length ? <T color={C.muted}>No doses scheduled today.</T> : null}
              {!view.perms.mark ? <T size={12.5} color={C.muted}>{first} has not allowed you to mark doses. You can still send a reminder.</T> : null}
            </Card>
          )}

          <Card style={{ gap: 10 }}>
            <T size={17} w="sb">Good to know</T>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Feather name="alert-circle" size={18} color={C.amber} />
              <T>Allergies: <T w="sb">{view.profile.allergies?.length ? view.profile.allergies.join(', ') : 'None recorded'}</T></T>
            </View>
            {view.profile.emergency?.name ? (
              <Btn
                title={`Call ${view.profile.emergency.name.split(' ')[0]} (${view.profile.emergency.relation || 'emergency contact'})`}
                icon="phone"
                kind="ghost"
                onPress={() => void Linking.openURL(`tel:${(view.profile.emergency?.phone ?? '').replace(/[^\d+]/g, '')}`)}
              />
            ) : null}
          </Card>

          <Card style={{ gap: 4 }}>
            <T size={17} w="sb">Recent activity</T>
            {view.activity.slice(0, 12).map((a) => (
              <View key={a.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line2 }}>
                <T size={14}><T size={14} w="sb">{a.who}</T> {a.text}</T>
                <T size={12} color={C.muted}>{ago(a.at)}</T>
              </View>
            ))}
          </Card>
          <Callout icon="info">Updates appear here live. Pull down to refresh.</Callout>
        </>
      ) : null}
      <Btn title="Leave this care circle" kind="danger" icon="log-out" block onPress={leave} />
      <View style={{ height: 30 }} />
    </Screen>
  );
}
