import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost, toast } from '@/components/ui';
import { configureNotifications, handleResponse, rescheduleSoon, setupNotificationTypes, supported } from '@/lib/notifications';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { afterSignIn, flush, pullOwner, startOwnerLive } from '@/lib/sync';
import { C } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();
configureNotifications();

function respond(r: Notifications.NotificationResponse) {
  // give the router a moment to mount when the app was opened from a notification
  setTimeout(() => {
    void handleResponse(r).then((m) => m && toast(m));
    Notifications.clearLastNotificationResponse();
  }, 350);
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
const flushSoon = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), 1200);
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (fontsLoaded && hydrated) void SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  // Reminders: keep scheduled notifications in step with medicines and doses.
  useEffect(() => {
    if (!hydrated) return;
    void setupNotificationTypes().then(rescheduleSoon);
    const unsub = useStore.subscribe((s, prev) => {
      if (s.meds !== prev.meds || s.doses !== prev.doses || s.settings.remindersOn !== prev.settings.remindersOn || s.settings.followUp !== prev.settings.followUp) {
        rescheduleSoon();
      }
      if (s.sharing.outbox.length && s.sharing.outbox !== prev.sharing.outbox) flushSoon();
    });
    if (!supported) return unsub;
    const sub = Notifications.addNotificationResponseReceivedListener(respond);
    const last = Notifications.getLastNotificationResponse();
    if (last) respond(last);
    return () => {
      unsub();
      sub.remove();
    };
  }, [hydrated]);

  // Sharing: reconnect, send queued changes, and listen for caregivers.
  useEffect(() => {
    if (!hydrated || !supabase) return;
    const live = () =>
      startOwnerLive((a) => {
        toast(`${a.who.split(' ')[0]} ${a.text}`);
      });
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      if (!useStore.getState().sharing.circleId) await afterSignIn();
      if (useStore.getState().sharing.circleId) {
        live();
        await flush();
        await pullOwner();
      }
    })();
    const app = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      rescheduleSoon();
      if (useStore.getState().sharing.circleId) {
        void flush().then(() => pullOwner());
      }
    });
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) flushSoon();
    });
    return () => {
      app.remove();
      net();
    };
  }, [hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          <Stack.Screen name="med/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="med-form" options={{ presentation: 'modal' }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
