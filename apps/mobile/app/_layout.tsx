import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/lib/auth';
import { colors } from '@/theme/tokens';

/**
 * The countdown, sports and contract screens are open to everyone. The squad
 * step is the first moment the app needs an identity, and the tabs and the
 * proof camera sit behind it.
 */
export default function RootLayout() {
  const session = useSession();
  if (session === undefined) return null;
  const signedIn = !!session;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="proof" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="weigh" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
