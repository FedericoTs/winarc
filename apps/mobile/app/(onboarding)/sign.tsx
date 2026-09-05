import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SEASON_ONE, buildContract, formatStake } from '@arc/domain';
import { Body, Button, Display, Eyebrow, Screen } from '@/components/ui';
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
    setBusy(false);
    if (lErr) return setError(lErr.message);
    router.replace('/(tabs)/today');
  }

  return (
    <Screen>
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
