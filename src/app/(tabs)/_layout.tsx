import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function TabsLayout() {
  const onboarded = useStore((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="medicines" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="care" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
