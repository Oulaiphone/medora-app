import { View } from 'react-native';

import { BackBar, Callout, Card, Over, Screen, T } from '@/components/ui';
import { usingDemoOcrKey } from '@/lib/ocr';
import { sharingConfigured } from '@/lib/supabase';
import { C } from '@/lib/theme';

const REAL = [
  ['Your medicines and dose history', 'Saved on this phone and kept after you close the app.'],
  ['Reminders', 'Real phone notifications with Taken, Snooze and Skip, plus a follow-up after 30 minutes.'],
  ['Label scanning', 'Reads the text on a photo, fills in the form, and you check it before saving.'],
  ['Allergy check and refill counts', 'A name-based check against your allergies, and a countdown of pills on hand.'],
  ['PDF summary', 'Made on the phone; you choose who to send it to.'],
  ['Caregiver sharing', 'Invite codes, permissions you control, and live updates for caregivers.'],
  ['Accessibility', 'Larger text, simplified home, and read-aloud in English, Spanish and Chinese.'],
];
const NEXT = [
  ['Caregiver push alerts', 'Alerting a caregiver’s phone when a dose is missed needs a server and an installed app build.'],
  ['On-device scanning', 'Reading labels without sending the photo anywhere.'],
  ['Pharmacy refills', 'Requesting a refill straight from the app.'],
  ['Provider connection', 'Sending summaries to a clinic system instead of a PDF.'],
];

export default function About() {
  return (
    <Screen top={<BackBar />} padBottom={false}>
      <View style={{ gap: 2 }}>
        <T size={27} w="sb">About MedOra</T>
        <T color={C.muted}>A simpler way for patients and caregivers to manage medicines together.</T>
      </View>
      <Card style={{ gap: 12 }}>
        <Over>Working in this version</Over>
        {REAL.map(([t, d]) => (
          <View key={t}>
            <T w="sb">{t}</T>
            <T size={14} color={C.soft}>{d}</T>
          </View>
        ))}
      </Card>
      <Card style={{ gap: 12 }}>
        <Over color={C.muted}>Planned next</Over>
        {NEXT.map(([t, d]) => (
          <View key={t}>
            <T w="sb">{t}</T>
            <T size={14} color={C.soft}>{d}</T>
          </View>
        ))}
      </Card>
      <Card style={{ gap: 10 }}>
        <Over>Where your information goes</Over>
        <T size={14} color={C.soft}>
          • Medicines, doses and your profile stay on this phone.{'\n'}
          • Label photos are sent to OCR.space to read the text{usingDemoOcrKey ? ' (using their public demo key)' : ''}. Use “Sample” to try scanning without sending anything.{'\n'}
          • If you turn on sharing, your medicines, doses and allergies are copied to your private care circle{sharingConfigured ? '' : ' (not set up in this copy)'}. Only people you invite can see them, and only what you allow.
        </T>
      </Card>
      <Callout kind="warn">MedOra is a student project. It helps you keep track, but it is not a medical device and does not give medical advice. Always follow your doctor or pharmacist.</Callout>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
