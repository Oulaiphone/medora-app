import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pictorial } from '@/components/meds';
import { Avatar, BackBar, Btn, Card, Chip, Choice, Icon, Over, Screen, T, toast, type AnyIcon } from '@/components/ui';
import { label } from '@/lib/dates';
import { printPlan, sharePlanPdf } from '@/lib/printPlan';
import { dosesFor, nextOpen, type DoseSlot } from '@/lib/schedule';
import { reminderScript, speak, stopSpeaking } from '@/lib/speech';
import { useStore } from '@/lib/store';
import { sharingConfigured } from '@/lib/supabase';
import { flush } from '@/lib/sync';
import { useSyncStatus, type SyncKind } from '@/lib/syncStatus';
import { C } from '@/lib/theme';
import type { Settings } from '@/lib/types';

const LANGS = ['en-US', 'es-ES', 'zh-CN'] as const;
const WAVE = [6, 10, 16, 9, 20, 26, 13, 22, 30, 17, 11, 24, 31, 19, 12, 27, 21, 9, 16, 25, 12, 8, 18, 12, 7];

const FEATURES: { n: string; icon: AnyIcon; title: string; sub: string; why: string }[] = [
  { n: '01', icon: 'users', title: 'Caregiver view', sub: 'What caregivers see on their side of the care team.', why: 'So the whole care team works from the same information.' },
  { n: '02', icon: 'image', title: 'Pictorial instructions', sub: 'Instructions as simple pictures.', why: 'So instructions are clear at a glance.' },
  { n: '03', icon: 'volume-2', title: 'Audio reminders', sub: 'Reminders and instructions read aloud.', why: 'For people who have trouble reading the screen.' },
  { n: '04', icon: 'wifi-off', title: 'Offline and recovery', sub: 'No internet, a new phone, or no phone at all.', why: 'The routine keeps working, can be recovered, and exists on paper too.' },
];

const SYNC_INFO: { kind: SyncKind; label: string; icon: AnyIcon; text: string }[] = [
  { kind: 'ok', label: 'Up to date', icon: 'check-circle', text: 'Everything is saved on this phone and in your account.' },
  { kind: 'waiting', label: 'Waiting to sync', icon: 'clock', text: 'Saved on this phone. It will send when you are back online.' },
  { kind: 'attention', label: 'Needs attention', icon: 'alert-circle', text: 'Something could not be saved to your account, for example you need to sign in again.' },
];
const SYNC_CHIP = { ok: 'ok', waiting: 'up', attention: 'bad' } as const;

export default function WhatsNext() {
  const meds = useStore((s) => s.meds);
  const doses = useStore((s) => s.doses);
  const profile = useStore((s) => s.profile);
  const members = useStore((s) => s.members);
  const mode = useStore((s) => s.settings.mode);
  const voiceLang = useStore((s) => s.settings.voiceLang);
  const backedUp = useStore((s) => !!s.sharing.circleId);
  const setSettings = useStore((s) => s.setSettings);
  const sync = useSyncStatus();
  const [open, setOpen] = useState<number | null>(null);
  const [picId, setPicId] = useState<string | null>(null);

  const slots = useMemo(() => dosesFor(meds, doses), [meds, doses]);
  const next = nextOpen(slots);
  const firstName = profile.name.split(' ')[0] || 'you';
  const helper = members[0]?.name.split(' ')[0] || 'Your caregiver';
  const picMed = meds.find((m) => m.id === picId) ?? meds.find((m) => m.appearance || m.photo) ?? meds[0];

  // audio preview
  const [playing, setPlaying] = useState(false);
  const [bars] = useState(() => WAVE.map(() => new Animated.Value(0.35)));
  useEffect(() => {
    if (!playing) {
      bars.forEach((b) => b.setValue(0.35));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i % 6) * 70),
          Animated.timing(b, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.35, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing, bars]);
  useEffect(() => () => stopSpeaking(), []);

  const audioMed = next?.med ?? meds[0];
  const audioTime = next?.time ?? audioMed?.times[0] ?? '08:00';
  const script = audioMed ? reminderScript(audioMed, audioTime, voiceLang, profile.name) : '';
  const play = () => {
    if (!audioMed) return toast('Add a medicine first.');
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    speak(script, voiceLang, () => setPlaying(false));
  };
  const setLang = (v: Settings['voiceLang']) => {
    stopSpeaking();
    setPlaying(false);
    setSettings({ voiceLang: v });
  };
  const nudge = () =>
    toast(mode === 'demo' ? `Preview: in a shared care circle, ${firstName} sees this reminder in MedOra.` : 'Open Care Team to share with a caregiver.');
  const print = () => void printPlan(profile, meds).catch(() => toast('Printing is not available on this device.'));
  const savePdf = () => void sharePlanPdf(profile, meds).catch(() => toast('Could not create the PDF.'));

  const statusChip = (s: DoseSlot) =>
    s.status === 'taken' ? <Chip label="Taken" kind="ok" /> : s.status === 'skipped' ? <Chip label="Skipped" kind="sk" /> : s.status === 'missed' ? <Chip label="Missed" kind="bad" /> : <Chip label="Not yet" kind="up" />;

  const waveform = (height: number) => (
    <View style={[styles.wave, { height }]}>
      {WAVE.map((h, i) => (
        <Animated.View key={i} style={[styles.bar, { height: (h * height) / 44, backgroundColor: playing ? C.mint : C.tint2, transform: [{ scaleY: bars[i] }] }]} />
      ))}
    </View>
  );

  // ---------------- small previews on the list ----------------
  const previews: ReactNode[] = [
    <View key="cg" style={styles.mock}>
      <View style={styles.mockbar}>
        <Avatar text={members[0]?.name || 'Caregiver'} tone="peach" size={34} />
        <View>
          <T size={14} w="sb">{helper}’s phone</T>
          <T size={12} color={C.muted}>{firstName}’s medicines today</T>
        </View>
      </View>
      {slots.slice(0, 5).map((s) => (
        <View key={s.key} style={styles.line}>
          <T size={14}>
            {s.med.name} <T size={12} color={C.muted}>{label(s.time)}</T>
          </T>
          {statusChip(s)}
        </View>
      ))}
      {!slots.length ? <T size={13} color={C.muted}>No doses today.</T> : null}
    </View>,
    picMed ? (
      <View key="pic" style={styles.mock}>
        <T w="sb">{picMed.name} {picMed.strength}</T>
        <Pictorial med={picMed} />
      </View>
    ) : (
      <T key="pic" color={C.muted}>Add a medicine to see its picture instructions.</T>
    ),
    <View key="au" style={[styles.mock, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Stop' : 'Play audio reminder'} onPress={play} style={styles.play}>
        <Feather name={playing ? 'pause' : 'play'} size={24} color={C.white} />
      </Pressable>
      {waveform(44)}
    </View>,
    <View key="off" style={styles.mock}>
      <View style={[styles.status, !sync.online && { backgroundColor: C.amberbg }]}>
        <Feather name={sync.online ? 'wifi' : 'wifi-off'} size={17} color={sync.online ? C.sageink : C.amber} />
        <T size={14} w="sb" color={sync.online ? C.sageink : C.amber}>{sync.online ? 'Online right now' : 'Offline · using saved information'}</T>
      </View>
      <View style={styles.line}>
        <T size={13} color={C.muted}>Sync status</T>
        <Chip label={sync.label} kind={SYNC_CHIP[sync.kind]} />
      </View>
    </View>,
  ];

  // ---------------- big, presentation-size versions ----------------
  const big: ReactNode[] = [
    <View key="cg" style={{ gap: 16 }}>
      <View style={[styles.mock, styles.bigMock]}>
        <View style={styles.mockbar}>
          <Avatar text={members[0]?.name || 'Caregiver'} tone="peach" size={48} />
          <View>
            <T size={20} w="sb">{helper}’s phone</T>
            <T size={15} color={C.muted}>{firstName}’s medicines today</T>
          </View>
        </View>
        {slots.map((s) => (
          <View key={s.key} style={[styles.line, { paddingVertical: 6 }]}>
            <View>
              <T size={19} w="sb">{s.med.name}</T>
              <T size={14} color={C.muted}>{label(s.time)} · {s.med.strength}</T>
            </View>
            {statusChip(s)}
          </View>
        ))}
        {next ? <Btn title={`Send ${firstName} a reminder`} icon="bell" size="xl" block onPress={nudge} /> : null}
      </View>
      <Bullets
        items={[
          ['eye', 'See today’s doses live: taken, skipped or missed'],
          ['bell', 'Send a gentle reminder when a dose is late'],
          ['check-square', 'Mark a dose for them, only if they allow it'],
          ['lock', 'The patient decides what each caregiver can see'],
        ]}
      />
      <Btn title="Open Care Team" kind="soft" icon="users" block onPress={() => { setOpen(null); router.navigate('/care'); }} />
    </View>,
    <View key="pic" style={{ gap: 16 }}>
      {picMed ? (
        <>
          <View style={[styles.mock, styles.bigMock]}>
            {picMed.photo ? <Image source={{ uri: picMed.photo }} style={styles.bigPhoto} contentFit="cover" /> : null}
            <T size={24} w="sb">{picMed.name} {picMed.strength}</T>
            <Pictorial med={picMed} />
            {picMed.appearance ? (
              <View style={styles.pill}>
                <View style={[styles.pillShape, { width: 64, height: 64, borderRadius: 32 }]}>
                  <View style={{ position: 'absolute', left: 8, right: 8, top: 29, height: 2.5, backgroundColor: '#C3D1CB' }} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={18} w="sb">Your pill looks like this</T>
                  <T size={15} color={C.muted}>{picMed.appearance}</T>
                </View>
              </View>
            ) : null}
          </View>
          {meds.length > 1 ? (
            <View style={{ gap: 8 }}>
              <T size={13} w="sb" color={C.soft}>Show another medicine</T>
              <Choice options={meds.map((m) => m.id)} value={picMed.id} onChange={setPicId} labels={Object.fromEntries(meds.map((m) => [m.id, m.name]))} />
            </View>
          ) : null}
        </>
      ) : (
        <T color={C.muted}>Add a medicine to see its picture instructions.</T>
      )}
      <Bullets
        items={[
          ['hash', 'How many: one tablet, half a tablet, two puffs'],
          ['sunrise', 'When: morning, afternoon, evening'],
          ['coffee', 'Food: with food, after food, empty stomach'],
          ['camera', 'A photo of the pill or box you can recognise'],
        ]}
      />
    </View>,
    <View key="au" style={{ gap: 16 }}>
      <View style={[styles.mock, styles.bigMock, { alignItems: 'center', gap: 18 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Stop' : 'Play audio reminder'} onPress={play} style={[styles.play, { width: 96, height: 96, borderRadius: 48 }]}>
          <Feather name={playing ? 'pause' : 'play'} size={40} color={C.white} />
        </Pressable>
        {waveform(64)}
        {script ? (
          <View style={[styles.quote, { alignSelf: 'stretch' }]}>
            <T size={20}>“{script}”</T>
          </View>
        ) : null}
        <Choice<Settings['voiceLang']> options={LANGS} value={voiceLang} onChange={setLang} labels={{ 'en-US': 'English', 'es-ES': 'Español', 'zh-CN': '中文' }} />
      </View>
      <Bullets
        items={[
          ['volume-2', 'Reads the reminder and instructions out loud'],
          ['globe', 'English, Spanish and Chinese'],
          ['eye-off', 'Helps people with low vision or reading difficulty'],
        ]}
      />
      <T size={13} color={C.muted}>Tip: turn off silent mode to hear it.</T>
    </View>,
    <View key="off" style={{ gap: 18 }}>
      <View style={[styles.mock, styles.bigMock]}>
        <T size={13} w="b" color={C.green} style={{ letterSpacing: 1 }}>OFFLINE</T>
        <View style={[styles.status, { padding: 14 }, !sync.online && { backgroundColor: C.amberbg }]}>
          <Feather name={sync.online ? 'wifi' : 'wifi-off'} size={22} color={sync.online ? C.sageink : C.amber} />
          <T size={18} w="sb" color={sync.online ? C.sageink : C.amber}>{sync.online ? 'Online right now' : 'Offline · using saved information'}</T>
        </View>
        {['Today’s schedule and reminders', 'Marking doses as taken or skipped', 'Your full dose history'].map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Feather name="check" size={20} color={C.green} />
            <T size={17}>{t}</T>
          </View>
        ))}
        <T size={14} color={C.muted}>Try it: turn on Airplane mode. MedOra keeps working.</T>
      </View>

      <View style={[styles.mock, styles.bigMock]}>
        <T size={13} w="b" color={C.green} style={{ letterSpacing: 1 }}>SYNC STATUS</T>
        {SYNC_INFO.map((s) => {
          const on = s.kind === sync.kind;
          return (
            <View key={s.kind} style={[styles.syncRow, on && styles.syncOn]}>
              <Icon name={s.icon} size={24} color={s.kind === 'ok' ? C.green : s.kind === 'waiting' ? C.amber : C.red} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T size={17} w="sb">{s.label}</T>
                  {on ? <Chip label="Now" kind={SYNC_CHIP[s.kind]} /> : null}
                </View>
                <T size={14} color={C.soft}>{on ? sync.detail : s.text}</T>
              </View>
            </View>
          );
        })}
        {sync.kind !== 'ok' ? <Btn title="Try again now" icon="refresh-cw" kind="soft" onPress={() => void flush()} /> : null}
      </View>

      <View style={[styles.mock, styles.bigMock]}>
        <T size={13} w="b" color={C.green} style={{ letterSpacing: 1 }}>NEW OR LOST PHONE</T>
        <T size={17}>
          Your schedule is backed up to your account. On a new phone, install MedOra, tap <T size={17} w="sb">Restore from my account</T>, and sign in. Your medicines, history and contacts come back.
        </T>
        {sharingConfigured ? (
          <Btn title={backedUp ? 'Backed up · view account' : 'Turn on backup'} icon={backedUp ? 'check' : 'upload-cloud'} kind="soft" onPress={() => { setOpen(null); router.push('/account'); }} />
        ) : (
          <T size={13} color={C.muted}>Backup turns on when the account service is set up (SETUP.md, step 3).</T>
        )}
      </View>

      <View style={[styles.mock, styles.bigMock]}>
        <T size={13} w="b" color={C.green} style={{ letterSpacing: 1 }}>PRINTED BACKUP</T>
        <T size={17}>A one-page plan with photos, doses, times, instructions, allergies, emergency contacts and the last-updated date, plus a wallet card.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['Fridge', 'Wallet', 'Emergency visits', 'No smartphone needed'].map((t) => (
            <Chip key={t} label={t} kind="plan" />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn title="Print plan" icon="printer" style={{ flex: 1 }} onPress={print} />
          <Btn title="Save PDF" icon="download" kind="ghost" style={{ flex: 1 }} onPress={savePdf} />
        </View>
      </View>
    </View>,
  ];

  const f = open != null ? FEATURES[open] : null;

  return (
    <Screen top={<BackBar title="Back" right={<Chip label="Roadmap" kind="plan" icon="star" />} />} padBottom={false}>
      <View style={{ gap: 4 }}>
        <Over>Roadmap</Over>
        <T size={29} w="sb" style={{ letterSpacing: -0.7 }}>What’s next for MedOra</T>
        <T color={C.muted}>Four features from our product roadmap. Tap a card to see it full screen.</T>
      </View>

      <Card tint style={{ flexDirection: 'row', gap: 12 }}>
        <Feather name="info" size={20} color={C.green} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <T w="sb">Shaped by what patients and caregivers told us</T>
          <T size={13.5} color={C.soft}>These are early versions. We will keep improving them with feedback from older adults and their families.</T>
        </View>
      </Card>

      {FEATURES.map((ft, i) => (
        <Pressable key={ft.n} accessibilityRole="button" accessibilityLabel={`${ft.title}, open full screen`} onPress={() => setOpen(i)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
          <Card style={{ gap: 14 }}>
            <FeatureHead ft={ft} />
            <View pointerEvents={i === 2 ? 'auto' : 'none'}>{previews[i]}</View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={13} color={C.muted} style={{ fontStyle: 'italic', flex: 1 }}>{ft.why}</T>
              <View style={styles.expand}>
                <Feather name="maximize-2" size={14} color={C.green} />
                <T size={13} w="b" color={C.green}>Tap to enlarge</T>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}

      <View style={styles.closing}>
        <T size={23} w="sb" color={C.white} style={{ lineHeight: 29 }}>One simple routine, shared by everyone who helps.</T>
        <T size={14.5} color="#D7ECE3">Thank you. We’re happy to take questions.</T>
        <Btn title="Back to the app" kind="white" onPress={() => router.navigate('/')} />
      </View>
      <View style={{ height: 30 }} />

      <Modal visible={open != null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={styles.modalBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(null)} style={styles.round}>
              <Feather name="x" size={22} color={C.ink} />
            </Pressable>
            <T size={14} w="sb" color={C.muted}>{open != null ? `${open + 1} of ${FEATURES.length}` : ''}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous" disabled={!open} onPress={() => setOpen((o) => (o ? o - 1 : o))} style={[styles.round, !open && { opacity: 0.35 }]}>
                <Feather name="chevron-left" size={22} color={C.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next" disabled={open === FEATURES.length - 1} onPress={() => setOpen((o) => (o != null && o < FEATURES.length - 1 ? o + 1 : o))} style={[styles.round, open === FEATURES.length - 1 && { opacity: 0.35 }]}>
                <Feather name="chevron-right" size={22} color={C.ink} />
              </Pressable>
            </View>
          </View>
          {f && open != null ? (
            <ScrollView key={open} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View style={[styles.icon, { width: 56, height: 56, borderRadius: 16 }]}>
                  <Icon name={f.icon} size={28} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={13} w="b" color={C.muted} style={{ letterSpacing: 1 }}>{f.n}</T>
                  <T size={30} w="sb" style={{ letterSpacing: -0.7, lineHeight: 34 }}>{f.title}</T>
                </View>
              </View>
              <T size={18} color={C.soft}>{f.sub}</T>
              {big[open]}
              <T size={15} color={C.muted} style={{ fontStyle: 'italic' }}>{f.why}</T>
              {open < FEATURES.length - 1 ? (
                <Btn title={`Next: ${FEATURES[open + 1].title}`} icon="arrow-right" size="xl" block onPress={() => setOpen(open + 1)} />
              ) : (
                <Btn title="Done" size="xl" block onPress={() => setOpen(null)} />
              )}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function FeatureHead({ ft }: { ft: (typeof FEATURES)[number] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={styles.icon}>
        <Icon name={ft.icon} size={19} color={C.green} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={11.5} w="b" color={C.muted} style={{ letterSpacing: 1 }}>{ft.n}</T>
        <T size={18} w="sb">{ft.title}</T>
        <T size={13.5} color={C.soft}>{ft.sub}</T>
      </View>
      <Chip label="Early version" kind="new" />
    </View>
  );
}

function Bullets({ items }: { items: [AnyIcon, string][] }) {
  return (
    <View style={{ gap: 12 }}>
      {items.map(([icon, text]) => (
        <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={[styles.icon, { width: 36, height: 36 }]}>
            <Icon name={icon} size={18} color={C.green} />
          </View>
          <T size={17} style={{ flex: 1 }}>{text}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.iconbg, alignItems: 'center', justifyContent: 'center' },
  mock: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line2, borderRadius: 16, padding: 12, gap: 9 },
  bigMock: { backgroundColor: C.card, borderColor: C.line, padding: 18, gap: 14, borderRadius: 20 },
  mockbar: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  pillShape: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#9FB3AB', backgroundColor: C.white },
  bigPhoto: { width: '100%', height: 200, borderRadius: 14 },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 3, overflow: 'hidden' },
  bar: { flex: 1, maxWidth: 6, borderRadius: 3 },
  quote: { backgroundColor: C.bg, borderLeftWidth: 4, borderLeftColor: C.mint, borderTopRightRadius: 12, borderBottomRightRadius: 12, padding: 14 },
  status: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.sage, borderRadius: 12, padding: 10 },
  syncRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line2 },
  syncOn: { borderColor: C.tint2, backgroundColor: C.tint, borderWidth: 2 },
  expand: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.tint, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 10 },
  closing: { backgroundColor: C.green2, borderRadius: 22, padding: 20, gap: 12 },
  modalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
