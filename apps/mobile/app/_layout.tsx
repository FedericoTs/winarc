import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { BigShouldersDisplay_700Bold, BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
// Per-weight subpaths, so only the faces in use ship; the package root would bundle every weight.
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { useSession } from '@/lib/auth';
import { colors } from '@/theme/tokens';

// Held until the faces and the session are both ready, so no screen and no
// share card ever paints in the system font first.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The countdown, sports and contract screens are open to everyone. The squad
 * step is the first moment the app needs an identity, and the tabs and the
 * proof camera sit behind it.
 */
export default function RootLayout() {
  const session = useSession();
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_900Black,
    BigShouldersDisplay_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // A font that fails to load falls back to the system face rather than
  // holding the splash forever; the arc still has to open.
  const ready = session !== undefined && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
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
          <Stack.Screen name="attest" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
