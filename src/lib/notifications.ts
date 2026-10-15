import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { at, dateKey, addDays, fromMin, label, toMin } from './dates';
import { doseSentence, dosesFor } from './schedule';
import { useStore } from './store';
import type { Medication } from './types';

const CHANNEL = 'reminders';
const CATEGORY = 'dose';
const MAX_PENDING = 60; // iOS keeps at most 64 pending notifications per app
export const supported = Platform.OS !== 'web';

type DoseData = { medId: string; time: string; date?: string; kind: 'dose' | 'followup' | 'snooze' | 'test' };

export function configureNotifications() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setupNotificationTypes() {
  if (!supported) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Medicine reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  // Each button opens the app so the dose is saved reliably, even if the app was closed.
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'TAKEN', buttonTitle: 'Taken', options: { opensAppToForeground: true } },
    { identifier: 'SNOOZE', buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: true } },
    { identifier: 'SKIP', buttonTitle: 'Skip', options: { opensAppToForeground: true, isDestructive: true } },
  ]);
}

export async function hasPermission(): Promise<boolean> {
  if (!supported) return false;
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

export async function askPermission(): Promise<boolean> {
  if (!supported) return false;
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

function content(med: Medication, time: string, data: DoseData): Notifications.NotificationContentInput {
  const followup = data.kind === 'followup';
  return {
    title: followup ? `Did you take ${med.name}?` : `Time for ${med.name} ${med.strength}`.trim(),
    body: followup
      ? `It was due at ${label(time)}. Tap Taken or Skip so your care team knows.`
      : `${doseSentence(med)} · ${label(time)}`,
    data,
    sound: 'default',
    categoryIdentifier: CATEGORY,
  };
}

let queued: ReturnType<typeof setTimeout> | null = null;
let running = false;
/** Rebuild every scheduled reminder from the current medicines and today's doses. */
export function rescheduleSoon() {
  if (!supported) return;
  if (queued) clearTimeout(queued);
  queued = setTimeout(() => {
    queued = null;
    void rescheduleAll();
  }, 700);
}

export async function rescheduleAll() {
  if (!supported || running) return;
  running = true;
  try {
    const { meds, doses, settings } = useStore.getState();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.remindersOn || !(await hasPermission())) return;
    let count = 0;
    const active = meds.filter((m) => m.active);
    for (const m of active) {
      for (const t of m.times) {
        if (count >= MAX_PENDING) break;
        const [hour, minute] = fromMin(toMin(t) - m.remindOffset).split(':').map(Number);
        await Notifications.scheduleNotificationAsync({
          identifier: `dose_${m.id}_${t.replace(':', '')}`,
          content: content(m, t, { medId: m.id, time: t, kind: 'dose' }),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
        });
        count++;
      }
    }
    if (!settings.followUp) return;
    const now = new Date();
    for (const d of [dateKey(now), dateKey(addDays(now, 1))]) {
      for (const slot of dosesFor(active, doses, d, now)) {
        if (slot.log || count >= MAX_PENDING) continue;
        const fire = new Date(at(d, slot.time).getTime() + 30 * 60000);
        if (fire.getTime() <= now.getTime() + 5000) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `fu_${slot.med.id}_${d}_${slot.time.replace(':', '')}`,
          content: content(slot.med, slot.time, { medId: slot.med.id, time: slot.time, date: d, kind: 'followup' }),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, channelId: CHANNEL },
        });
        count++;
      }
    }
  } catch (e) {
    console.warn('Could not schedule reminders', e);
  } finally {
    running = false;
  }
}

/** Sends a real reminder in a few seconds, for trying the flow or demoing it. */
export async function sendTestReminder(seconds = 5): Promise<string | null> {
  if (!supported) return 'Reminders only work on a phone.';
  if (!(await askPermission())) return 'Notifications are turned off for MedOra in your phone settings.';
  const { meds, doses } = useStore.getState();
  const slots = dosesFor(meds, doses);
  const slot = slots.find((s) => !s.log) ?? slots[0];
  const med = slot?.med ?? meds[0];
  if (!med) return 'Add a medicine first.';
  const time = slot?.time ?? med.times[0];
  await Notifications.scheduleNotificationAsync({
    content: content(med, time, { medId: med.id, time, date: dateKey(), kind: 'test' }),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
  });
  return null;
}

async function snooze(med: Medication, time: string, date: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze_${med.id}_${date}_${time.replace(':', '')}`,
    content: content(med, time, { medId: med.id, time, date, kind: 'snooze' }),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600, channelId: CHANNEL },
  });
}

/** Handles a tap on a reminder or one of its buttons. Returns a short message to show, if any. */
export async function handleResponse(resp: Notifications.NotificationResponse): Promise<string | null> {
  const req = resp.notification.request;
  const key = `${req.identifier}@${resp.notification.date}@${resp.actionIdentifier}`;
  const st = useStore.getState();
  if (st.handled.includes(key)) return null;
  st.markHandled(key);
  const data = req.content.data as Partial<DoseData> | undefined;
  if (!data?.medId || !data.time) return null;
  const med = st.meds.find((m) => m.id === data.medId);
  if (!med) return null;
  const date = data.date ?? dateKey(new Date(resp.notification.date));
  const params = { id: med.id, date, time: data.time };
  switch (resp.actionIdentifier) {
    case 'TAKEN':
      st.logDose(med.id, date, data.time, 'taken');
      return `${med.name} marked as taken.`;
    case 'SNOOZE':
      await snooze(med, data.time, date);
      return `Snoozed. We'll remind you again in 10 minutes.`;
    case 'SKIP':
      router.push({ pathname: '/med/[id]', params: { ...params, skip: '1' } });
      return null;
    default:
      router.push({ pathname: '/med/[id]', params });
      return null;
  }
}

export async function pendingCount(): Promise<number> {
  if (!supported) return 0;
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
