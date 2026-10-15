import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { BackBar, Btn, Card, Choice, Field, Screen, T, TextLink, toast } from '@/components/ui';
import { uid } from '@/lib/id';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Provider } from '@/lib/types';

const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Not sure'] as const;

export default function ProfileEdit() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [dob, setDob] = useState(profile.dob);
  const [blood, setBlood] = useState<string>(profile.bloodGroup || 'Not sure');
  const [pharmacy, setPharmacy] = useState(profile.pharmacy);
  const [allergies, setAllergies] = useState(profile.allergies.join(', '));
  const [em, setEm] = useState(profile.emergency);
  const [providers, setProviders] = useState<Provider[]>(profile.providers);

  const dobOk = !dob || /^\d{4}-\d{2}-\d{2}$/.test(dob);

  const save = () => {
    if (!name.trim()) return toast('Please add your name.');
    if (!dobOk) return toast('Write the date of birth as YYYY-MM-DD, e.g. 1958-01-14.');
    setProfile({
      name: name.trim(),
      phone: phone.trim(),
      dob: dob.trim(),
      bloodGroup: blood === 'Not sure' ? '' : blood,
      pharmacy: pharmacy.trim(),
      allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
      emergency: { name: em.name.trim(), relation: em.relation.trim(), phone: em.phone.trim() },
      providers: providers.filter((p) => p.name.trim()),
    });
    toast('Profile saved.');
    router.back();
  };

  const setProv = (id: string, patch: Partial<Provider>) => setProviders((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen top={<BackBar title="Cancel" />} padBottom={false}>
        <T size={27} w="sb">Edit profile</T>
        <Card style={{ gap: 14 }}>
          <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" hint={dobOk ? undefined : 'Use the format YYYY-MM-DD'} />
          <View style={{ gap: 8 }}>
            <T size={13} w="sb" color={C.soft}>Blood group</T>
            <Choice options={BLOOD as readonly string[]} value={blood} onChange={setBlood} />
          </View>
          <Field label="Preferred pharmacy" value={pharmacy} onChangeText={setPharmacy} autoCapitalize="words" />
          <Field label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="e.g. Penicillin, Sulfa" hint="Separate with commas" />
        </Card>

        <Card style={{ gap: 14 }}>
          <T size={17} w="sb">Emergency contact</T>
          <Field label="Name" value={em.name} onChangeText={(v) => setEm({ ...em, name: v })} autoCapitalize="words" />
          <Field label="Relationship" value={em.relation} onChangeText={(v) => setEm({ ...em, relation: v })} placeholder="e.g. Daughter" />
          <Field label="Phone" value={em.phone} onChangeText={(v) => setEm({ ...em, phone: v })} keyboardType="phone-pad" />
        </Card>

        <Card style={{ gap: 14 }}>
          <T size={17} w="sb">Healthcare providers</T>
          {providers.map((p) => (
            <View key={p.id} style={{ gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Name" value={p.name} onChangeText={(v) => setProv(p.id, { name: v })} placeholder="e.g. Dr. Elena Chen" autoCapitalize="words" />
                </View>
                <Pressable accessibilityLabel="Remove provider" onPress={() => setProviders((ps) => ps.filter((x) => x.id !== p.id))} style={{ padding: 12 }}>
                  <Feather name="trash-2" size={18} color={C.red} />
                </Pressable>
              </View>
              <Field label="Role" value={p.role} onChangeText={(v) => setProv(p.id, { role: v })} placeholder="e.g. Primary care physician" />
              <Field label="Clinic or pharmacy" value={p.org} onChangeText={(v) => setProv(p.id, { org: v })} autoCapitalize="words" />
            </View>
          ))}
          <TextLink title="Add a provider" onPress={() => setProviders((ps) => [...ps, { id: uid(), name: '', role: '', org: '' }])} />
        </Card>

        <Btn title="Save profile" icon="check" size="xl" block onPress={save} />
        <View style={{ height: 30 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
