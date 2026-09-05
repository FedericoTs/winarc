import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { identify, resetIdentity, track } from './analytics';

/**
 * Sign in with Apple on iOS, a six-digit email code everywhere. No passwords.
 * After any sign-in the profile gets the device timezone, which the daily
 * tick and the Sunday ledger run on.
 */

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) identify(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) identify(next.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

export async function appleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

export async function signInWithApple(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple returned no identity token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (error) throw error;
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  await ensureProfile(name || undefined);
  track({ name: 'signed_in', method: 'apple' });
}

export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  await ensureProfile();
  track({ name: 'signed_in', method: 'email' });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  resetIdentity();
}

/** Writes the device timezone and, when the profile has none, a display name. */
export async function ensureProfile(displayName?: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', auth.user.id).maybeSingle();
  const patch: { tz: string; display_name?: string } = { tz };
  if (displayName && !profile?.display_name) patch.display_name = displayName.slice(0, 40);
  await supabase.from('profiles').update(patch).eq('id', auth.user.id);
}
