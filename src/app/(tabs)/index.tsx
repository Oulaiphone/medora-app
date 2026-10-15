import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { CheckBox, DoseRow, SLOT_COLOR } from '@/components/meds';
import { Avatar, Btn, Card, Chip, IconBox, Over, Screen, Section, T, TextLink, TopBar, toast, type AnyIcon } from '@/components/ui';
import { age, ago, greeting, label, longDay, slotOf, type Slot } from '@/lib/dates';
import { askPermission } from '@/lib/notifications';
import { dosesFor, nextOpen, refillDue, supplyText, unitWord, type DoseSlot } from '@/lib/schedule';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function Home() {
  const meds = useStore((s) => s.meds);
  const doses = useStore((s) => s.doses);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const activity = useStore((s) => s.activity);
  const logDose = useStore((s) => s.logDose);
  const undoDose = useStore((s) => s.undoDose);
  const setSettings = useStore((s) => s.setSettings);

  // refresh "due / missed" labels when the screen comes back into view
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const t = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(t);
    }, []),
  );
  const slots = useMemo(() => dosesFor(meds, doses, undefined, now), [meds, doses, now]);
  const next = nextOpen(slots);
  const done = slots.filter((s) => s.status === 'taken').length;
  const first = profile.name.split(' ')[0] || 'there';

  const toggle = (s: DoseSlot) => {
    if (s.status === 'taken') {
      undoDose(s.med.id, s.date, s.time);
      toast(`${s.med.name} marked as not taken.`);
    } else {
      logDose(s.med.id, s.date, s.time, 'taken');
      toast(`${s.med.name} marked as taken.`);
    }
  };

  const call = () => {
    if (!profile.emergency.phone) return router.push('/profile-edit');
    void Linking.openURL(`tel:${profile.emergency.phone.replace(/[^\d+]/g, '')}`).catch(() => toast('Calling is not available on this device.'));
  };

  const turnOnReminders = async () => {
    const ok = await askPermission();
    if (!ok) {
      toast('Allow notifications for MedOra in your phone settings.');
      return;
    }
    setSettings({ remindersOn: true });
    toast('Reminders are on.');
  };

  const greet = (
    <View style={{ gap: 2 }}>
      <T size={29} w="sb" style={{ letterSpacing: -0.8 }}>
        {greeting(now)}, {first}.
      </T>
      <T color={C.muted}>{longDay(now)}</T>
    </View>
  );

  if (settings.simpleHome) {
    return (
      <Screen top={<TopBar />}>
        {greet}
        {next ? (
          <Card style={styles.big}>
            <Over>Next medicine · {label(next.time)}</Over>
            <T size={32} w="sb" style={{ letterSpacing: -0.8 }}>
              {next.med.name}
            </T>
            <T size={18} color={C.soft}>
              {next.med.dose} {unitWord(next.med.form, next.med.dose)} of {next.med.strength}. {next.med.instructions}.
            </T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn title="I took it" icon="check" size="xl" style={{ flex: 1 }} onPress={() => toggle(next)} />
              <Btn title="Skip" kind="ghost" size="xl" onPress={() => router.push({ pathname: '/med/[id]', params: { id: next.med.id, date: next.date, time: next.time, skip: '1' } })} />
            </View>
          </Card>
        ) : (
          <Card style={styles.big}>
            <Feather name="check-circle" size={32} color={C.green} />
            <T size={26} w="sb">
              {slots.length ? 'All done for today' : 'No medicines yet'}
            </T>
            <T size={17} color={C.soft}>
              {slots.length ? `${done} of ${slots.length} medicines taken.` : 'Turn off simplified home in Profile to add one.'}
            </T>
          </Card>
        )}
        {slots.length ? (
          <Card>
            <T size={19} w="sb">Today</T>
            {slots.map((s, i) => (
              <View key={s.key} style={[styles.simpleRow, i === slots.length - 1 && { borderBottomWidth: 0 }]}>
                <CheckBox status={s.status} onPress={() => toggle(s)} name={s.med.name} />
                <T size={18} w="sb" style={{ flex: 1 }}>
                  {s.med.name}
                </T>
                <T size={16} color={C.muted}>
                  {label(s.time)}
                </T>
              </View>
            ))}
          </Card>
        ) : null}
        {profile.emergency.name ? (
          <Card onPress={call} label={`Call ${profile.emergency.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconBox name="phone" size={48} icon={22} />
            <View>
              <T size={19} w="sb">Call {profile.emergency.name.split(' ')[0]}</T>
              <T color={C.muted}>Emergency contact</T>
            </View>
          </Card>
        ) : null}
        <TextLink title="Turn off simplified home" onPress={() => setSettings({ simpleHome: false })} />
      </Screen>
    );
  }

  const groups: Slot[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const refills = meds.filter((m) => m.active && refillDue(m));
  const yrs = age(profile.dob);

  return (
    <Screen top={<TopBar />}>
      {greet}

      <View style={styles.pcard}>
        <View style={styles.who}>
          <Avatar text={profile.name || first} size={54} />
          <View style={{ flex: 1 }}>
            <T size={17} w="sb">
              {profile.name || first}
            </T>
            <T size={13.5} color={C.muted}>
              {[yrs != null ? `Age ${yrs}` : null, profile.bloodGroup ? `Blood group ${profile.bloodGroup}` : null].filter(Boolean).join(' · ') || 'Add your health details'}
            </T>
          </View>
          <TextLink title="View profile" icon={false} size={13} onPress={() => router.navigate('/profile')} />
        </View>
        <Pressable style={styles.fact} onPress={() => router.push('/safety')}>
          <View style={styles.alert}>
            <T w="b" color={C.amber}>!</T>
          </View>
          <View>
            <T size={12.5} color={C.muted}>Known allergy</T>
            <T w="sb">{profile.allergies.length ? profile.allergies.join(', ') : 'None recorded'}</T>
          </View>
        </Pressable>
        {profile.providers[0] ? (
          <Pressable style={styles.fact} onPress={() => router.navigate('/care')}>
            <Feather name="heart" size={22} color={C.green} />
            <View>
              <T size={12.5} color={C.muted}>Primary provider</T>
              <T w="sb">{profile.providers[0].name}</T>
            </View>
          </Pressable>
        ) : null}
        <Pressable style={styles.callrow} onPress={call} accessibilityRole="button">
          <Feather name="phone" size={20} color={C.green} />
          <View>
            <T size={12.5} color={C.muted}>Emergency contact</T>
            <T w="sb" color={C.green}>
              {profile.emergency.name ? `Call ${profile.emergency.name.split(' ')[0]}` : 'Add an emergency contact'}
            </T>
          </View>
        </Pressable>
      </View>

      {meds.length === 0 ? (
        <Card style={{ gap: 12 }}>
          <Over>Get started</Over>
          <T size={21} w="sb">Add your first medicine</T>
          <T color={C.soft}>Scan the label on the box or bottle, or type the details in.</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="Scan a label" icon="scan" style={{ flex: 1 }} onPress={() => router.navigate('/scan')} />
            <Btn title="Type it in" kind="ghost" style={{ flex: 1 }} onPress={() => router.push('/med-form')} />
          </View>
        </Card>
      ) : null}

      {meds.length > 0 && !settings.remindersOn ? (
        <Card tint style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconBox name="bell" kind="white" />
            <View style={{ flex: 1 }}>
              <T w="sb">Turn on reminders</T>
              <T size={13.5} color={C.soft}>Get a notification at each dose time, with Taken, Snooze and Skip.</T>
            </View>
          </View>
          <Btn title="Turn on reminders" size="sm" onPress={turnOnReminders} />
        </Card>
      ) : null}

      {slots.length ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 4 }}>
              <Over>{longDay(now)}</Over>
              <T size={22} w="sb">Today’s medicines</T>
            </View>
            <Chip label={`${done} of ${slots.length} complete`} />
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${slots.length ? (done / slots.length) * 100 : 0}%` }]} />
          </View>
          <T size={13.5} color={C.muted}>
            {next ? `${done ? 'You’re doing well. ' : ''}Your next medicine is at ${label(next.time)}.` : done === slots.length ? 'All done for today. Nice work.' : 'No more doses today. Skipped and missed doses stay in your history.'}
          </T>
          {groups.map((g) => {
            const list = slots.filter((s) => slotOf(s.time) === g);
            if (!list.length) return null;
            const times = Array.from(new Set(list.map((s) => label(s.time))));
            return (
              <View key={g} style={{ gap: 9, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.dot, { backgroundColor: SLOT_COLOR[g] }]} />
                  <T size={16} w="sb">{g}</T>
                  <T size={13} color={C.muted}>
                    {times.length > 1 ? `${times[0]} – ${times[times.length - 1]}` : times[0]}
                  </T>
                </View>
                {list.map((s) => (
                  <DoseRow key={s.key} slot={s} onToggle={() => toggle(s)} />
                ))}
              </View>
            );
          })}
        </Card>
      ) : null}

      <Section title="Quick actions">
        <View style={styles.grid}>
          <QA icon="scan" solid title="Scan a prescription" sub="Read a label with the camera" onPress={() => router.navigate('/scan')} />
          <QA icon="plus" title="Add medicine" sub="Enter details yourself" onPress={() => router.push('/med-form')} />
          <QA icon="users" title="My care team" sub="People who support you" onPress={() => router.navigate('/care')} />
          <QA icon="clock" title="History & documents" sub="Doses and past changes" onPress={() => router.push('/history')} />
        </View>
      </Section>

      {activity.length ? (
        <Section title="Recent updates" action={<TextLink title="View history" onPress={() => router.push('/history')} />}>
          <Card style={{ paddingVertical: 4 }}>
            {activity.slice(0, 3).map((a, i) => (
              <View key={a.id} style={[styles.update, i === Math.min(2, activity.length - 1) && { borderBottomWidth: 0 }]}>
                <IconBox name="edit-2" size={36} icon={16} />
                <View style={{ flex: 1 }}>
                  <T size={14.5}>
                    <T size={14.5} w="sb">{a.who === profile.name ? 'You' : a.who}</T> {a.text}
                  </T>
                  <T size={12.5} color={C.muted}>{ago(a.at)}</T>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Card tint style={styles.side}>
        <IconBox name="shield" kind="white" />
        <View style={{ flex: 1, gap: 2 }}>
          <Over>Medication safety</Over>
          <T size={17} w="sb">{profile.allergies.length ? 'Your recorded allergy' : 'No allergies recorded'}</T>
          <T size={13.5} color={C.muted}>
            {profile.allergies.length ? `${profile.allergies.join(', ')} ${profile.allergies.length > 1 ? 'are' : 'is'} listed in your profile. MedOra checks new medicines against it.` : 'Add allergies so MedOra can check new medicines against them.'}
          </T>
          <View style={{ marginTop: 6 }}>
            <TextLink title="Review safety info" size={13.5} onPress={() => router.push('/safety')} />
          </View>
        </View>
      </Card>

      {refills.length ? (
        <Card tint style={styles.side}>
          <IconBox name="calendar" kind="white" />
          <View style={{ flex: 1, gap: 2 }}>
            <Over>Coming up</Over>
            <T size={17} w="sb">
              {refills.length} refill{refills.length > 1 ? 's' : ''} needed
            </T>
            {refills.map((m) => (
              <T key={m.id} size={13.5} color={C.muted}>
                {m.name} · {supplyText(m)}
              </T>
            ))}
          </View>
        </Card>
      ) : null}

      <T size={12} color={C.muted} center>
        MedOra helps you keep track. It does not replace advice from your doctor or pharmacist.
      </T>
    </Screen>
  );
}

function QA({ icon, title, sub, onPress, solid }: { icon: AnyIcon; title: string; sub: string; onPress: () => void; solid?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.qa, pressed && { opacity: 0.8 }]}>
      <IconBox name={icon} kind={solid ? 'solid' : 'tint'} />
      <View style={{ gap: 2 }}>
        <T size={14.5} w="sb">{title}</T>
        <T size={12.5} color={C.muted}>{sub}</T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pcard: { backgroundColor: '#E9F3EF', borderWidth: 1, borderColor: '#D6E7E0', borderRadius: 22, padding: 18, gap: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#D3E3DD' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alert: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.amberbg, alignItems: 'center', justifyContent: 'center' },
  callrow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E1ECE7' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.line2, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.green },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qa: { width: '48%', flexGrow: 1, minHeight: 124, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, justifyContent: 'space-between', gap: 12 },
  update: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line2 },
  side: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  big: { gap: 12, borderWidth: 2, borderColor: C.tint2, backgroundColor: '#EEF6F3' },
  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line2 },
});
