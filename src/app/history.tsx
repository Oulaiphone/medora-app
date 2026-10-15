import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { STATUS } from '@/components/meds';
import { BackBar, Btn, Card, Chip, Row, Screen, T } from '@/components/ui';
import { addDays, ago, dateKey, label, parseKey, shortDate, weekdayShort } from '@/lib/dates';
import { adherence, dosesFor, week } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const DOT: Record<string, string> = { taken: C.green, skipped: C.amberdot, missed: '#D98C8C', due: '#D5DCD9', upcoming: '#D5DCD9' };

export default function History() {
  const meds = useStore((s) => s.meds);
  const doses = useStore((s) => s.doses);
  const activity = useStore((s) => s.activity);
  const myName = useStore((s) => s.profile.name);

  const now = useMemo(() => new Date(), []);
  const grid = useMemo(() => week(meds, doses, now), [meds, doses, now]);
  const a7 = adherence(meds, doses, now, 7);
  const a30 = adherence(meds, doses, now, 30);
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = dateKey(addDays(now, -i));
      const slots = dosesFor(meds, doses, d, now).filter((s) => s.status !== 'upcoming');
      if (slots.length) out.push({ d, slots });
    }
    return out;
  }, [meds, doses, now]);
  const docs = meds.filter((m) => m.document);

  return (
    <Screen top={<BackBar />} padBottom={false}>
      <View style={{ gap: 2 }}>
        <T size={27} w="sb">History & documents</T>
        <T color={C.muted}>Every dose and change, in one place.</T>
      </View>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={17} w="sb">This week</T>
          <T size={13} color={C.muted}>
            {a7.total ? `${Math.round((a7.taken / a7.total) * 100)}% taken` : 'No doses yet'}
          </T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {grid.map((c) => (
            <View key={c.date} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <T size={12} w={c.date === dateKey(now) ? 'b' : 'r'} color={c.date === dateKey(now) ? C.green : C.muted}>
                {weekdayShort(parseKey(c.date))}
              </T>
              <View style={{ gap: 4, alignItems: 'center' }}>
                {c.statuses.map((s, i) => (
                  <View key={i} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: DOT[s] }} />
                ))}
              </View>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip label="Taken" kind="ok" />
          <Chip label="Skipped" kind="up" />
          <Chip label="Missed" kind="bad" />
          <Chip label="Later today" kind="sk" />
        </View>
        {a30.total ? (
          <T size={13.5} color={C.soft}>
            Last 30 days: {a30.taken} of {a30.total} scheduled doses taken.
          </T>
        ) : null}
        <Btn title="Export or share" icon="share" kind="soft" block onPress={() => router.push('/share')} />
      </Card>

      {days.map(({ d, slots }) => (
        <Card key={d} style={{ paddingVertical: 6 }}>
          <T size={15} w="sb" style={{ paddingTop: 8 }}>
            {d === dateKey(now) ? 'Today' : d === dateKey(addDays(now, -1)) ? 'Yesterday' : shortDate(d)}
          </T>
          {slots.map((s, i) => {
            const [t, kind] = STATUS[s.status];
            return (
              <Row
                key={s.key}
                title={`${s.med.name} · ${label(s.time)}`}
                sub={s.log ? `${s.log.by === myName ? 'You' : s.log.by}${s.log.reason ? ` · ${s.log.reason}` : ''}` : 'Not recorded'}
                right={<Chip label={t} kind={kind} />}
                onPress={() => router.push({ pathname: '/med/[id]', params: { id: s.med.id, date: s.date, time: s.time } })}
                last={i === slots.length - 1}
              />
            );
          })}
        </Card>
      ))}

      <Card style={{ paddingVertical: 6 }}>
        <T size={17} w="sb" style={{ paddingTop: 8 }}>Documents</T>
        {docs.length ? (
          docs.map((m, i) => <Row key={m.id} icon="file-text" title={m.name} sub={m.document} last={i === docs.length - 1} onPress={() => router.push({ pathname: '/med/[id]', params: { id: m.id } })} />)
        ) : (
          <T size={14} color={C.muted} style={{ paddingVertical: 10 }}>Labels you scan show up here.</T>
        )}
      </Card>

      <Card style={{ paddingVertical: 6 }}>
        <T size={17} w="sb" style={{ paddingTop: 8 }}>All activity</T>
        {activity.slice(0, 40).map((a, i, arr) => (
          <Row key={a.id} title={`${a.who === myName ? 'You' : a.who} ${a.text}`} sub={ago(a.at)} last={i === arr.length - 1} />
        ))}
      </Card>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
