import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Field, Over, T, TopBar } from '@/components/ui';
import { useStore } from '@/lib/store';
import { sharingConfigured } from '@/lib/supabase';
import { C } from '@/lib/theme';

export default function Welcome() {
  const startDemo = useStore((s) => s.startDemo);
  const startPersonal = useStore((s) => s.startPersonal);
  const [step, setStep] = useState<'intro' | 'name'>('intro');
  const [name, setName] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <TopBar right={<View />} />
          </SafeAreaView>
          {[300, 440, 580].map((d) => (
            <View key={d} style={[styles.ring, { width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2 }]} />
          ))}
          <View style={styles.phone}>
            <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: C.green }} />
            <View style={[styles.bar, { width: '70%', height: 9 }]} />
            <View style={styles.panel}>
              {[80, 60, 70].map((w) => (
                <View key={w} style={[styles.bar, { width: `${w}%`, backgroundColor: '#C9DFD7', height: 6 }]} />
              ))}
            </View>
            <View style={[styles.bar, { height: 34 }]} />
            <View style={[styles.bar, { height: 34 }]} />
          </View>
          <View style={[styles.float, { left: 24, top: 170 }]}>
            <Feather name="check" size={15} color={C.green} />
            <View>
              <T size={12} w="sb">Morning complete</T>
              <T size={10.5} color={C.muted}>2 doses taken</T>
            </View>
          </View>
          <View style={[styles.float, { right: 22, top: 270 }]}>
            <Feather name="users" size={15} color={C.green} />
            <View>
              <T size={12} w="sb">Care team connected</T>
              <T size={10.5} color={C.muted}>Sarah can help</T>
            </View>
          </View>
        </View>

        <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18, gap: 16 }}>
          <Over>Welcome to MedOra</Over>
          <T size={36} w="sb" style={{ letterSpacing: -1.2, lineHeight: 40 }}>
            Simpler medication management.
          </T>
          <T size={16.5} color={C.muted}>
            Your medicines, reminders, and care team, all in one place.
          </T>

          {step === 'intro' ? (
            <>
              <View style={{ gap: 11 }}>
                {['See what to take today', 'Get reminders with Taken, Snooze and Skip', 'Share only what you choose'].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', gap: 11, alignItems: 'center' }}>
                    <View style={styles.tick}>
                      <Feather name="check" size={13} color={C.green} />
                    </View>
                    <T w="sb">{t}</T>
                  </View>
                ))}
              </View>
              <Btn title="Set up my medicines" icon="arrow-right" size="xl" block onPress={() => setStep('name')} />
              <Btn
                title="Explore with sample information"
                kind="ghost"
                block
                onPress={() => {
                  startDemo();
                  router.replace('/');
                }}
              />
              {sharingConfigured ? (
                <Btn
                  title="New phone? Restore from my account"
                  kind="soft"
                  icon="refresh-ccw"
                  block
                  onPress={() => {
                    startPersonal('');
                    router.replace('/');
                    router.push('/account');
                  }}
                />
              ) : null}
              <T size={12.5} color={C.muted}>
                The sample uses fictional information for Margaret Wilson. Your own information stays on this phone unless you turn on sharing.
              </T>
            </>
          ) : (
            <>
              <Field label="What should MedOra call you?" placeholder="Your first name" value={name} onChangeText={setName} autoFocus autoCapitalize="words" returnKeyType="done" />
              <Btn
                title="Continue"
                size="xl"
                block
                disabled={!name.trim()}
                onPress={() => {
                  startPersonal(name);
                  router.replace('/');
                }}
              />
              <Btn title="Back" kind="ghost" block onPress={() => setStep('intro')} />
            </>
          )}
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, overflow: 'hidden', backgroundColor: '#D9ECE5' },
  ring: { position: 'absolute', left: '50%', top: '58%', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(46,106,85,0.14)' },
  phone: { position: 'absolute', left: '50%', marginLeft: -78, top: 110, width: 156, height: 290, backgroundColor: C.white, borderRadius: 28, padding: 15, gap: 10, shadowColor: C.deep, shadowOpacity: 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  bar: { borderRadius: 6, backgroundColor: '#E9EFEC' },
  panel: { backgroundColor: C.tint, borderRadius: 12, padding: 10, gap: 7 },
  float: { position: 'absolute', backgroundColor: C.white, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 11, flexDirection: 'row', gap: 8, alignItems: 'center', shadowColor: C.deep, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.iconbg, alignItems: 'center', justifyContent: 'center' },
});
