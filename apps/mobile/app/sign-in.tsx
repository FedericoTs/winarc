import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Body, Button, Display, Eyebrow, Screen } from '@/components/ui';
import { appleAvailable, sendEmailCode, signInWithApple, verifyEmailCode } from '@/lib/auth';
import { features } from '@/config';
import { colors, fonts } from '@/theme/tokens';

/**
 * Reached from the squad step, the first moment the app needs an identity,
 * and from any protected tab. `next` says where to go afterwards.
 */
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [apple, setApple] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  function done() {
    router.replace((next as never) ?? '/(onboarding)/squad');
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(email.trim());
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Eyebrow>Sign in</Eyebrow>
      <Display size={40}>Your squad needs{'\n'}to know it's you.</Display>
      <Body muted>No password. Your name and squad are the only things anyone sees, and only inside the squad.</Body>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={14}
          style={{ height: 52 }}
          onPress={() => run(signInWithApple)}
        />
      ) : null}
      {features.emailSignIn ? (
      <View style={styles.box}>
        <Text style={styles.label}>{sent ? `Code sent to ${email}` : 'Or use your email'}</Text>
        {!sent ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.ink3}
              style={styles.input}
            />
            <Button title="Send a code" disabled={busy || !email.includes('@')} onPress={sendCode} />
          </>
        ) : (
          <>
            <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="6-digit code" placeholderTextColor={colors.ink3} maxLength={6} style={styles.input} />
            <Button title="Continue" disabled={busy || code.length < 6} onPress={() => run(() => verifyEmailCode(email.trim(), code.trim()))} />
          </>
        )}
      </View>
      ) : !apple ? (
        <View style={styles.box}>
          <Text style={styles.label}>Season one</Text>
          <Body muted>WinArc signs in with Apple on iPhone this season. Android and email arrive at day 30.</Body>
        </View>
      ) : null}
      {error ? <Body style={{ color: colors.rose }}>{error}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink2 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground, borderRadius: 12, padding: 12, color: colors.ink, fontSize: 15 },
});
