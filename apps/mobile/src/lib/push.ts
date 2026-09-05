import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from './supabase';

/**
 * Push is one nudge at 20:00, and only when a proof is still missing; the
 * selection runs in SQL (migration 0003). The app's job is the token: ask
 * once, right after the contract is signed, and refresh it on every open.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushState = 'registered' | 'denied' | 'unavailable';

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/** With `ask`, prompts for permission; without it, only a device that already said yes is refreshed. */
export async function registerForPush(opts: { ask: boolean }): Promise<PushState> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'unavailable';
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && opts.ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('nudges', { name: 'Proof reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const id = projectId();
    if (!id) {
      console.warn('No EAS projectId in app config; push tokens need an EAS project (see docs/ops/launch-checklist.md)');
      return 'unavailable';
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ profile_id: auth.user.id, token, platform: Platform.OS, last_seen_at: new Date().toISOString() }, { onConflict: 'profile_id,token' });
    return error ? 'unavailable' : 'registered';
  } catch {
    // Simulators and Expo Go have no push token; the app works without one.
    return 'unavailable';
  }
}

/** A tap on a nudge opens the screen named in its data, Today by default. Mount inside the signed-in navigator. */
export function usePushRouting(): void {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as { route?: string } | undefined;
      router.push((data?.route ?? '/(tabs)/today') as never);
    };
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);
}
