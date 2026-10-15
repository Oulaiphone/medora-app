import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { BackBar, Btn, Callout, Card, Over, Row, Screen, T, Toggle, toast } from '@/components/ui';
import { fromMin, label, toMin } from '@/lib/dates';
import { askPermission, pendingCount, rescheduleAll, sendTestReminder, supported } from '@/lib/notifications';
import { dosesFor } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Reminders() {
  const settings = useStore((s) => s.settings);
  const meds = useStore((s) => s.meds);
  const doses = useStore((s) => s.doses);
  const setSettings = useStore((s) => s.setSettings);
  const [pending, setPending] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void pendingCount().then(setPending);
    }, []),
  );
  const open = useMemo(() => dosesFor(meds, doses).filter((s) => !s.log && (s.status === 'upcoming' || s.status === 'due')), [meds, doses]);

  const setOn = async (v: boolean) => {
    if (v && !(await askPermission())) {
      toast('Allow notifications for MedOra in your phone settings first.');
      return;
    }
    setSettings({ remindersOn: v });
    await rescheduleAll();
    setPending(await pendingCount());
    toast(v ? 'Reminders are on.' : 'Reminders are off.');
  };

  const test = async () => {
    setSending(true);
    const err = await sendTestReminder(5);
    setSending(false);
    toast(err ?? 'A reminder arrives in 5 seconds. Lock your phone to see it like a real one.');
  };

  return (
    <Screen top={<BackBar />} padBottom={false}>
      <View style={{ gap: 2 }}>
        <T size={27} w="sb">Reminders</T>
        <T color={C.muted}>Gentle nudges, with your care team as backup.</T>
      </View>

      {!supported ? <Callout kind="warn">Reminders work on a phone. Open MedOra in Expo Go or as an installed app.</Callout> : null}

      <Card style={{ paddingVertical: 6 }}>
        <Row title="Medicine reminders" sub={settings.remindersOn ? `${pending ?? '…'} scheduled on this phone` : 'Off'} right={<Toggle label="Medicine reminders" value={settings.remindersOn} onChange={(v) => void setOn(v)} />} />
        <Row
          title="Second reminder after 30 min"
          sub="If a dose is still open"
          right={<Toggle label="Second reminder" value={settings.followUp} onChange={(v) => setSettings({ followUp: v })} />}
          last
        />
      </Card>

      <Card style={{ gap: 14 }}>
        <Over>How reminders work</Over>
        {[
          ['At dose time', 'Your phone shows a reminder with Taken, Snooze 10 min and Skip, even when MedOra is closed.'],
          ['30 minutes later', 'If the dose is still open, MedOra asks once more: “Did you take it?”'],
          ['Your care team', 'If you share with a caregiver, they see taken, skipped and missed doses live in their own app.'],
        ].map(([t, d], i) => (
          <View key={t} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.iconbg, alignItems: 'center', justifyContent: 'center' }}>
              <T w="b" color={C.green}>{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T w="sb">{t}</T>
              <T size={14} color={C.soft}>{d}</T>
            </View>
          </View>
        ))}
        <Btn title="Send me a test reminder" icon="bell" block loading={sending} onPress={() => void test()} />
      </Card>

      {settings.remindersOn && open.length ? (
        <Card style={{ paddingVertical: 6 }}>
          <T size={17} w="sb" style={{ paddingTop: 8 }}>Still to come today</T>
          {open.map((s, i) => (
            <Row
              key={s.key}
              icon="clock"
              title={`${s.med.name} ${s.med.strength}`}
              sub={s.med.remindOffset ? `Reminder at ${label(fromMin(toMin(s.time) - s.med.remindOffset))}, ${s.med.remindOffset} min early` : `Reminder at ${label(s.time)}`}
              last={i === open.length - 1}
            />
          ))}
        </Card>
      ) : null}

      <Callout icon="info">Change a medicine’s reminder time from its page: Edit details → Remind me.</Callout>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
