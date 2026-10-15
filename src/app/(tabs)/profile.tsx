import { router } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { Avatar, Btn, Card, Choice, KV, Over, PageTitle, Row, Screen, T, Toggle, TopBar, toast } from '@/components/ui';
import { age, shortDate } from '@/lib/dates';
import { rescheduleAll } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { sharingConfigured, useSession } from '@/lib/supabase';
import { signOut } from '@/lib/sync';
import { C } from '@/lib/theme';
import type { Settings } from '@/lib/types';

const LANGS = ['en-US', 'es-ES', 'zh-CN'] as const;

export default function Profile() {
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const members = useStore((s) => s.members);
  const sharing = useStore((s) => s.sharing);
  const setSettings = useStore((s) => s.setSettings);
  const resetAll = useStore((s) => s.resetAll);
  const session = useSession();
  const yrs = age(profile.dob);
  const demo = settings.mode === 'demo';

  const startOver = () => {
    const go = async () => {
      if (session) await signOut();
      resetAll();
      await rescheduleAll();
      router.replace('/welcome');
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(
      demo ? 'Leave the sample?' : 'Start over?',
      demo ? 'The sample data is removed and you can set up your own medicines.' : 'This removes your medicines, history and settings from this phone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: demo ? 'Leave sample' : 'Erase and start over', style: 'destructive', onPress: () => void go() },
      ],
    );
  };

  return (
    <Screen top={<TopBar />}>
      <PageTitle title="Profile & settings" sub="Personalize MedOra for you" />

      <Card dark style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <Avatar text={profile.name || 'You'} size={58} tone="green" />
          </View>
          <View style={{ flex: 1 }}>
            <T size={20} w="sb" color={C.white}>{profile.name || 'Your profile'}</T>
            <T size={13.5} color="#D7ECE3">
              {[demo ? 'Demo patient profile' : 'Stored on this phone', yrs != null ? `Age ${yrs}` : null].filter(Boolean).join(' · ')}
            </T>
          </View>
        </View>
        <Btn title="Edit profile" kind="white" icon="edit-2" block onPress={() => router.push('/profile-edit')} />
      </Card>

      <Card style={{ paddingVertical: 8 }}>
        <T size={17} w="sb" style={{ paddingTop: 6, paddingBottom: 2 }}>Personal details</T>
        <KV k="Full name" v={profile.name} />
        <KV k="Phone" v={profile.phone} />
        <KV k="Date of birth" v={/^\d{4}-\d{2}-\d{2}$/.test(profile.dob) ? shortDate(profile.dob) : profile.dob} />
        <KV k="Blood group" v={profile.bloodGroup} />
        <KV k="Preferred pharmacy" v={profile.pharmacy} last />
      </Card>

      <Card style={{ paddingVertical: 8 }}>
        <T size={17} w="sb" style={{ paddingTop: 6, paddingBottom: 2 }}>Health & emergency</T>
        <Row icon="alert-circle" iconKind="amber" title="Known allergies" sub={profile.allergies.join(', ') || 'None recorded'} onPress={() => router.push('/safety')} />
        <Row icon="phone" title="Emergency contact" sub={profile.emergency.name ? `${profile.emergency.name} · ${profile.emergency.relation}` : 'Not added'} onPress={() => router.push('/profile-edit')} />
        <Row icon="heart" title="Healthcare providers" sub={`${profile.providers.length} provider profile${profile.providers.length === 1 ? '' : 's'}`} onPress={() => router.navigate('/care')} last />
      </Card>

      <Card style={{ paddingVertical: 8 }}>
        <T size={17} w="sb" style={{ paddingTop: 6, paddingBottom: 2 }}>Reminders & sharing</T>
        <Row icon="bell" title="Reminder preferences" sub={settings.remindersOn ? `Reminders on${settings.followUp ? ' · follow-up after 30 min' : ''}` : 'Reminders off'} onPress={() => router.push('/reminders')} />
        <Row
          icon="lock"
          title="Caregiver sharing"
          sub={demo ? `${members.length} sample people with limited access` : sharing.circleId ? `${members.length} ${members.length === 1 ? 'person has' : 'people have'} limited access` : 'Not shared'}
          onPress={() => router.navigate('/care')}
        />
        <Row icon="share" title="Export or share" sub="Create a PDF medication summary" onPress={() => router.push('/share')} />
        <Row icon="clock" title="History & documents" sub="Your dose history and past changes" onPress={() => router.push('/history')} last={!sharingConfigured} />
        {sharingConfigured ? (
          <Row icon="user" title="Account" sub={session ? session.user.email ?? 'Signed in' : 'Sign in to share with caregivers'} onPress={() => router.push('/account')} last />
        ) : null}
      </Card>

      <Card tint style={{ paddingVertical: 12, gap: 4 }}>
        <Over>Accessibility</Over>
        <T size={17} w="sb">Make MedOra easier to use</T>
        <Row
          title="Larger text"
          sub="Increase text size throughout the app"
          right={<Toggle label="Larger text" value={settings.largeText} onChange={(v) => setSettings({ largeText: v })} />}
        />
        <Row
          title="Simplified home"
          sub="Show only your next medicine and today"
          right={<Toggle label="Simplified home" value={settings.simpleHome} onChange={(v) => { setSettings({ simpleHome: v }); if (v) toast('Simplified home is on. Open Home to see it.'); }} />}
        />
        <View style={{ gap: 8, paddingTop: 10 }}>
          <T w="sb">Read-aloud language</T>
          <Choice<Settings['voiceLang']> options={LANGS} value={settings.voiceLang} onChange={(v) => setSettings({ voiceLang: v })} labels={{ 'en-US': 'English', 'es-ES': 'Español', 'zh-CN': '中文' }} />
        </View>
      </Card>

      <Card style={{ paddingVertical: 8 }}>
        <Row icon="info" title="About MedOra & privacy" sub="What is real, what is planned, where data goes" onPress={() => router.push('/about')} />
        <Row icon="refresh-ccw" iconKind="red" title={demo ? 'Leave the sample' : 'Start over'} sub={demo ? 'Set up your own medicines' : 'Erase everything on this phone'} onPress={startOver} last />
      </Card>

      <T size={12} color={C.muted} center>
        {demo ? 'Margaret Wilson is a fictional demo patient. No real health information is stored.' : 'Your information stays on this phone unless you turn on sharing.'}
      </T>
    </Screen>
  );
}
