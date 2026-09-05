import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SEASON_ONE, buildContract, formatStake, sessionsPerWeek } from '@winarc/domain';
import { Body, Button, Display, Eyebrow, Screen } from '@/components/ui';
import { PosterCard, type CardRef } from '@/components/cards';
import { shareCard } from '@/lib/share';
import { registerForPush } from '@/lib/push';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useOnboarding } from '@/state/arc';
import { colors, fonts } from '@/theme/tokens';

/**
 * Signs the contract: writes the contract and its lines, then moves to Today.
 * The finger signature pad and the poster share card come next; see
 * docs/product/03-share-cards.md.
 */
export default function Sign() {
  const ob = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = buildContract(ob.contractInput());
  const poster = useRef<CardRef>(null);
  const stakeLabel = formatStake(ob.squad.stakeCents, ob.squad.currency);
  const spots = ob.squad.role === 'founder' ? `${Math.max(1, ob.squad.size - 1)} spots` : 'spots open';

  async function sign() {
    if (!ob.squad.id) return setError('Join or found a squad first');
    setBusy(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      return setError('Sign in first');
    }
    const { data: contract, error: cErr } = await supabase
      .from('contracts')
      .insert({ profile_id: auth.user.id, squad_id: ob.squad.id, season_id: SEASON_ONE.id, weigh_in: ob.weighIn, signed_at: new Date().toISOString() })
      .select('id')
      .single();
    if (cErr || !contract) {
      setBusy(false);
      return setError(cErr?.message ?? 'Could not save the contract');
    }
    const { error: lErr } = await supabase.from('contract_lines').insert(
      lines.map((l, i) => ({ contract_id: contract.id, key: l.key, kind: l.kind, name: l.name, per_week: l.perWeek, days: l.days, verification: l.verification, staked: l.staked, position: i })),
    );
    if (lErr) {
      setBusy(false);
      return setError(lErr.message);
    }
    track({ name: 'contract_signed', lines: lines.length, sessions_per_week: sessionsPerWeek(lines), weigh_in: ob.weighIn, stake_cents: ob.squad.stakeCents });
    // Opens today's due marks right away, so Today is never empty after signing.
    await supabase.rpc('open_today');
    // The one moment the ask makes sense: a signed contract with a 23:59 deadline. One nudge at 20:00, only if a proof is missing.
    await registerForPush({ ask: true }).catch(() => undefined);
    setBusy(false);
    // The poster is the growth loop: every Day 0 post is an invite with a deadline.
    try {
      const result = await shareCard(poster, `Join my squad on WinArc${ob.squad.code ? ` · ${ob.squad.code}` : ''}`);
      track({ name: 'poster_shared', result });
    } catch {
      // Sharing is optional; the contract is already signed.
      track({ name: 'poster_shared', result: 'failed' });
    }
    router.replace('/(tabs)/today');
  }

  return (
    <Screen>
      <View style={{ position: 'absolute', left: -2000, top: 0 }} pointerEvents="none">
        <PosterCard
          ref={poster}
          lines={lines}
          stakeLabel={stakeLabel}
          squadName={ob.squad.name || 'Squad forming'}
          code={ob.squad.code}
          spots={spots}
          locksOn={SEASON_ONE.locksOn}
          signedOn={new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        />
      </View>
      <Eyebrow>04 · Sign</Eyebrow>
      <View style={styles.poster}>
        <Display size={26}>Arc contract</Display>
        {lines.slice(0, 5).map((l) => (
          <Text key={l.key} style={styles.ln}>
            {l.perWeek}× {l.name}
          </Text>
        ))}
        <Text style={[styles.ln, { color: colors.gold }]}>
          {formatStake(ob.squad.stakeCents, ob.squad.currency)} per miss → squad pot
        </Text>
        <Text style={[styles.ln, { color: colors.ice }]}>
          {ob.squad.name || 'Squad forming'}
          {ob.squad.code ? ` · join ${ob.squad.code}` : ''} · locks {SEASON_ONE.locksOn}
        </Text>
      </View>
      <View style={styles.pad}>
        <Text style={styles.hint}>Sign with your finger</Text>
      </View>
      {error ? <Body style={{ color: colors.rose }}>{error}</Body> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 'auto', paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Sign & share" disabled={busy} onPress={sign} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  poster: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 4 },
  ln: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink2 },
  pad: { height: 150, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  hint: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.ink3 },
});
