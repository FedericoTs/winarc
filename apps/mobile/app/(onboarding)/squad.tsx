import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { STAKE_TIERS_CENTS, formatStake, normalizeCode, sessionsPerWeek, buildContract } from '@winarc/domain';
import { Body, Button, Chip, Display, Eyebrow, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { season } from '@/lib/season';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/auth';
import { useOnboarding } from '@/state/arc';
import { colors, fonts } from '@/theme/tokens';

type Door = 'found' | 'join' | 'draft';

export default function Squad() {
  const ob = useOnboarding();
  const session = useSession();
  const [door, setDoor] = useState<Door>('found');
  const [name, setName] = useState(ob.squad.name);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sessions = (() => {
    try {
      return sessionsPerWeek(buildContract(ob.contractInput()));
    } catch {
      return 0;
    }
  })();

  function needSignIn(): boolean {
    if (session) return false;
    router.push({ pathname: '/sign-in', params: { next: '/(onboarding)/squad' } });
    return true;
  }

  async function createSquad() {
    if (needSignIn()) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('create_squad', {
      p_name: name.trim() || 'My squad',
      p_size: ob.squad.size,
      p_stake_cents: ob.squad.stakeCents,
      p_pot_rule: 'pot',
      p_currency: ob.squad.currency,
      p_season: season().id,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    ob.setSquad({ id: data.id, code: data.code, name: data.name, role: 'founder' });
    track({ name: 'squad_founded', size: ob.squad.size, stake_cents: ob.squad.stakeCents, currency: ob.squad.currency });
    setMessage(`Squad created · ${data.code}`);
  }

  async function joinSquad() {
    if (needSignIn()) return;
    const normalized = normalizeCode(code);
    if (!normalized) return setMessage('Codes look like WIN-7K2Q');
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('join_squad', { p_code: normalized });
    setBusy(false);
    if (error) return setMessage(error.message);
    ob.setSquad({ id: data.id, code: data.code, name: data.name, size: data.size, stakeCents: data.stake_cents, potRule: data.pot_rule, currency: data.currency, role: 'member' });
    track({ name: 'squad_joined', size: data.size, stake_cents: data.stake_cents });
    setMessage(`Joined ${data.name} · ${formatStake(data.stake_cents, data.currency)} per miss · squad pot`);
  }

  return (
    <Screen>
      <Eyebrow>03 · Squad &amp; terms</Eyebrow>
      <Display size={30}>You don't do this alone.</Display>
      <View style={styles.seg}>
        {(['found', 'join', 'draft'] as Door[]).map((d) => (
          <Pressable key={d} onPress={() => setDoor(d)} style={[styles.segBtn, door === d && styles.segOn]}>
            <Text style={[styles.segText, door === d && { color: colors.ink }]}>{d[0]!.toUpperCase() + d.slice(1)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        {door === 'found' ? (
          <View style={styles.door}>
            <TextInput value={name} onChangeText={setName} placeholder="Squad name" placeholderTextColor={colors.ink3} maxLength={28} style={styles.input} />
            <Eyebrow>Squad size · your call, two to eight</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <Chip key={n} label={String(n)} on={ob.squad.size === n} onPress={() => ob.setSquad({ size: n })} />
              ))}
            </View>
            <Eyebrow>Squad terms · set once, everyone inherits</Eyebrow>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STAKE_TIERS_CENTS.map((c) => (
                <Pressable key={c} onPress={() => ob.setSquad({ stakeCents: c })} style={[styles.tier, ob.squad.stakeCents === c && styles.tierOn]}>
                  <Text style={[styles.tierValue, ob.squad.stakeCents === c && { color: colors.gold }]}>{formatStake(c, ob.squad.currency)}</Text>
                  <Text style={styles.tierLabel}>per miss</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.math}>
              {sessions} sessions a week · one miss puts <Text style={{ color: colors.gold }}>{formatStake(ob.squad.stakeCents, ob.squad.currency)}</Text> in the pot.
              {'\n'}Hit 90% and you keep everything; the pot buys the finale.
            </Text>
            <Button title={ob.squad.code ? `Your code · ${ob.squad.code}` : 'Create squad · get the code'} disabled={busy || !!ob.squad.code} onPress={createSquad} />
          </View>
        ) : null}
        {door === 'join' ? (
          <View style={styles.door}>
            <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Enter a code, e.g. WIN-7K2Q" placeholderTextColor={colors.ink3} maxLength={12} style={styles.input} />
            <Button title="Join" disabled={busy} onPress={joinSquad} />
            <Body muted style={{ fontSize: 12.5 }}>You inherit the squad's stake and pot rule. No terms to set.</Body>
          </View>
        ) : null}
        {door === 'draft' ? (
          <View style={styles.door}>
            <Body>The draft matches you into a squad by sport, timezone and frequency within a day. In season one it is done by hand.</Body>
            <Button title="Enter the draft" variant="ghost" onPress={() => setMessage('You are in the draft. We will message you within 24h.')} />
          </View>
        ) : null}
        {message ? <Body style={{ color: colors.mint }}>{message}</Body> : null}
        <Body muted style={{ fontSize: 12.5 }}>One home squad per contract. Two is a pact, five to eight is a squad.</Body>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Sign the contract" disabled={!ob.squad.id} onPress={() => router.push('/(onboarding)/sign')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: colors.surface2 },
  segText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink2 },
  door: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground, borderRadius: 12, padding: 12, color: colors.ink, fontSize: 15 },
  tier: { flex: 1, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 10, alignItems: 'center' },
  tierOn: { borderColor: colors.gold },
  tierValue: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  tierLabel: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink2, marginTop: 3 },
  math: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 19, color: colors.ink2, backgroundColor: colors.ground, borderRadius: 10, padding: 10 },
});
