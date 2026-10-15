import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { BackBar, Btn, Callout, Card, Choice, Row, Screen, T, Toggle, toast } from '@/components/ui';
import { shareSummaryPdf, summaryHtml, summaryText } from '@/lib/pdf';
import { printPlan, sharePlanPdf } from '@/lib/printPlan';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function ShareSummary() {
  const { to } = useLocalSearchParams<{ to?: string }>();
  const profile = useStore((s) => s.profile);
  const meds = useStore((s) => s.meds);
  const doses = useStore((s) => s.doses);
  const members = useStore((s) => s.members);
  const addActivity = useStore((s) => s.addActivity);

  const people = useMemo(
    () => Array.from(new Set([...profile.providers.map((p) => p.name), ...members.map((m) => m.name), 'My own records'])),
    [profile.providers, members],
  );
  const [recipient, setRecipient] = useState(to && people.includes(to) ? to : people[0]);
  const [inc, setInc] = useState({ meds: true, history: true, allergies: true, contacts: false });
  const [busy, setBusy] = useState(false);

  const pdf = async () => {
    setBusy(true);
    try {
      const html = summaryHtml(profile, meds, doses, { ...inc, recipient });
      await shareSummaryPdf(html, 'Medication summary');
      addActivity(recipient === 'My own records' ? 'created a medication summary' : `created a medication summary for ${recipient}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const text = async () => {
    await Share.share({ message: summaryText(profile, meds) });
  };

  const opts: { key: keyof typeof inc; title: string; sub: string }[] = [
    { key: 'meds', title: 'Medication list', sub: `${meds.filter((m) => m.active).length} medicines with times and instructions` },
    { key: 'history', title: 'Dose history', sub: 'Last 30 days: taken, skipped and missed' },
    { key: 'allergies', title: 'Allergies', sub: profile.allergies.join(', ') || 'None recorded' },
    { key: 'contacts', title: 'Contacts', sub: 'Emergency contact, providers and pharmacy' },
  ];

  return (
    <Screen top={<BackBar />} padBottom={false}>
      <View style={{ gap: 2 }}>
        <T size={27} w="sb">Export or share</T>
        <T color={C.muted}>Pick what goes in the summary and who it’s for.</T>
      </View>
      <Card style={{ paddingVertical: 6 }}>
        <T size={13} w="sb" color={C.soft} style={{ paddingTop: 8 }}>Include</T>
        {opts.map((o, i) => (
          <Row key={o.key} title={o.title} sub={o.sub} last={i === opts.length - 1} right={<Toggle label={o.title} value={inc[o.key]} onChange={(v) => setInc((x) => ({ ...x, [o.key]: v }))} />} />
        ))}
      </Card>
      <Card style={{ gap: 10 }}>
        <T size={13} w="sb" color={C.soft}>Prepared for</T>
        <Choice options={people} value={recipient} onChange={setRecipient} />
      </Card>
      <Callout>MedOra makes a PDF on this phone. You choose how to send it, by email, message or AirDrop, from the share menu.</Callout>
      <Btn title="Create PDF summary" icon="file-text" size="xl" block loading={busy} onPress={() => void pdf()} />
      <Btn title="Share as a text message" kind="ghost" icon="message-circle" block onPress={() => void text()} />

      <Card tint style={{ gap: 10, marginTop: 8 }}>
        <T size={18} w="sb">Printed backup</T>
        <T size={14} color={C.soft}>
          A one-page medication plan with photos, doses, times, instructions, allergies, emergency contacts and the date it was last updated. It also has a cut-out wallet card. Good for the fridge, your wallet and emergency visits.
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn title="Print" icon="printer" style={{ flex: 1 }} onPress={() => void printPlan(profile, meds).catch(() => toast('Printing is not available.'))} />
          <Btn title="Save PDF" icon="download" kind="ghost" style={{ flex: 1 }} onPress={() => void sharePlanPdf(profile, meds).catch(() => toast('Could not create the PDF.'))} />
        </View>
      </Card>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
