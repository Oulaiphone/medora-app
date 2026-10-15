import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, T } from '@/components/ui';
import { shortDate, dateKey } from '@/lib/dates';
import { readLabel, usingDemoOcrKey } from '@/lib/ocr';
import { makeThumb } from '@/lib/photo';
import { parseLabel, SAMPLE_LABEL_TEXT } from '@/lib/parseLabel';
import { allergyMatches } from '@/lib/safety';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { ScanDraft } from '@/lib/types';

export default function Scan() {
  const setScanDraft = useStore((s) => s.setScanDraft);
  const allergies = useStore((s) => s.profile.allergies);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, sweep]);

  const finish = (text: string, source: string, photo?: string) => {
    const p = parseLabel(text);
    const warnings: string[] = [];
    const hits = allergyMatches(p.name, allergies);
    if (hits.length) warnings.push(`Allergy alert: ${p.name || 'this medicine'} may be related to your recorded allergy (${hits.join(', ')}). Check with your pharmacist before taking it.`);
    if (p.asNeeded) warnings.push('The label says “as needed”. You may want reminders off for this one.');
    if (!p.confidence.name || !p.confidence.strength) warnings.push('Some details could not be read. Please fill them in.');
    if (!p.confidence.schedule) warnings.push('No schedule found on the label, so 8:00 AM was suggested. Change it if needed.');
    const draft: ScanDraft = {
      name: p.name,
      strength: p.strength,
      form: p.form,
      dose: p.dose,
      times: p.times,
      instructions: p.instructions,
      food: p.food,
      prescriber: p.prescriber,
      pharmacy: p.pharmacy,
      supply: p.supply,
      document: `${source} · ${shortDate(dateKey())}`,
      rawText: text,
      warnings,
      photo,
    };
    setScanDraft(draft);
    router.push({ pathname: '/med-form', params: { from: 'scan' } });
  };

  const run = async (uri: string) => {
    setPhoto(uri);
    setError(null);
    setBusy(true);
    try {
      const [text, photo] = await Promise.all([readLabel(uri), makeThumb(uri)]);
      finish(text, 'Scanned label', photo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('MedOra needs camera access to scan. You can allow it in your phone settings, or choose a photo instead.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) void run(res.assets[0].uri);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) void run(res.assets[0].uri);
  };

  const sample = () => {
    setPhoto(null);
    setError(null);
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      finish(SAMPLE_LABEL_TEXT, 'Sample label');
    }, 1200);
  };

  const lineY = sweep.interpolate({ inputRange: [0, 1], outputRange: [20, 300] });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: C.night }}>
      <View style={styles.head}>
        <Pressable accessibilityLabel="Close scanner" onPress={() => router.navigate('/')} style={styles.round}>
          <Feather name="x" size={20} color={C.white} />
        </Pressable>
        <Chip label={usingDemoOcrKey ? 'Demo text reader' : 'Text reader ready'} kind="light" icon="type" />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 20, alignItems: 'center', gap: 6 }}>
        <T size={24} w="sb" color={C.white} center>
          Scan a medication label
        </T>
        <T size={14.5} color="#B6D3C7" center>
          Take a clear photo of the label. MedOra reads the medicine, strength and directions, then you check them.
        </T>

        <View style={styles.frame}>
          {['tl', 'tr', 'bl', 'br'].map((c) => (
            <View key={c} style={[styles.corner, styles[c as 'tl']]} />
          ))}
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.paper}>
              <T size={10.5} w="b" color={C.deep} style={{ letterSpacing: 1.2, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.tint2 }}>
                OAKWOOD HEALTH PHARMACY
              </T>
              <T size={17} w="sb" style={{ marginTop: 14, marginBottom: 6 }}>
                Respira-Lite 25 mcg
              </T>
              {['For: Margaret Wilson', 'Take 1 tablet by mouth', 'Once daily · 8:30 AM', 'Qty 30 · Refills 2'].map((l) => (
                <T key={l} size={12.5} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2DED2' }}>
                  {l}
                </T>
              ))}
            </View>
          )}
          {busy ? <Animated.View style={[styles.sweep, { transform: [{ translateY: lineY }] }]} /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 }}>
          {busy ? (
            <>
              <Feather name="loader" size={15} color="#CDEBDD" />
              <T size={14} w="sb" color="#CDEBDD">Reading the label…</T>
            </>
          ) : error ? (
            <T size={14} w="sb" color="#FFC9C2" center>
              {error}
            </T>
          ) : (
            <T size={14} color="#CDEBDD">Hold the phone flat, in good light.</T>
          )}
        </View>

        <View style={styles.controls}>
          <Ctl icon="image" label="Photos" onPress={pickPhoto} disabled={busy} />
          <Pressable accessibilityRole="button" accessibilityLabel="Take a photo of the label" disabled={busy} onPress={takePhoto} style={({ pressed }) => [styles.shutter, (pressed || busy) && { opacity: 0.6 }]}>
            <View style={styles.shutterIn} />
          </Pressable>
          <Ctl icon="file-text" label="Sample" onPress={sample} disabled={busy} />
        </View>
        <T size={12} color="#9FBFB2" center style={{ marginTop: 6, paddingBottom: 110 }}>
          Photos are sent to OCR.space to read the text. “Sample” uses a built-in label and needs no internet. Always check the details before saving.
        </T>
      </View>
    </SafeAreaView>
  );
}

function Ctl({ icon, label, onPress, disabled }: { icon: 'image' | 'file-text'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={{ alignItems: 'center', gap: 6, width: 74, opacity: disabled ? 0.5 : 1 }}>
      <View style={styles.side}>
        <Feather name={icon} size={22} color={C.white} />
      </View>
      <T size={12.5} color="#CDE3DA">{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: '100%', height: 330, marginTop: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 18 },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: '#8FD3B6', zIndex: 2 },
  tl: { top: 8, left: 8, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  tr: { top: 8, right: 8, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bl: { bottom: 8, left: 8, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  br: { bottom: 8, right: 8, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  photo: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, borderRadius: 10 },
  paper: { width: '76%', backgroundColor: '#F7F4EC', borderRadius: 6, padding: 20, transform: [{ rotate: '-1.2deg' }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  sweep: { position: 'absolute', top: 0, left: '8%', right: '8%', height: 3, borderRadius: 2, backgroundColor: '#8FD3B6', shadowColor: '#8FD3B6', shadowOpacity: 0.9, shadowRadius: 10, zIndex: 3 },
  controls: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 8 },
  side: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.white },
});
