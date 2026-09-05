import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Body, Eyebrow, Screen, Tile } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

type Round = { id: string; week: number; pot_added_cents: number; hit_rate: number; mvp_profile_id: string | null };
type Entry = { profile_id: string; amount_cents: number; round_id: string | null; profiles: { display_name: string } | null };

/** Sunday at 21:00. Money is gold, misses are rose. Settlement is a ledger, never a charge. */
export default function Ledger() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from('rounds').select('id, week, pot_added_cents, hit_rate, mvp_profile_id').order('week', { ascending: false });
      setRounds((r as Round[] | null) ?? []);
      const { data: e } = await supabase.from('ledger_entries').select('profile_id, amount_cents, round_id, profiles(display_name)');
      setEntries((e as Entry[] | null) ?? []);
    })();
  }, []);

  const latest = rounds[0];
  const pot = entries.reduce((a, e) => a + e.amount_cents, 0);
  const owed = new Map<string, { name: string; cents: number }>();
  for (const e of entries) {
    const cur = owed.get(e.profile_id) ?? { name: e.profiles?.display_name ?? 'Member', cents: 0 };
    cur.cents += e.amount_cents;
    owed.set(e.profile_id, cur);
  }

  return (
    <Screen>
      <Eyebrow>The ledger{latest ? ` · week ${latest.week}` : ''}</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile value={`€${(pot / 100).toFixed(0)}`} label="in the pot" color={colors.gold} />
        <Tile value={latest ? `${Math.round(latest.hit_rate * 100)}%` : '–'} label="hit rate" />
        <Tile value={latest ? `+€${(latest.pot_added_cents / 100).toFixed(0)}` : '–'} label="this week" color={colors.gold} />
      </View>
      <ScrollView contentContainerStyle={{ gap: 0 }}>
        {[...owed.entries()].map(([id, o]) => (
          <View key={id} style={styles.row}>
            <Text style={styles.name}>{o.name}</Text>
            <Text style={[styles.amount, o.cents > 0 && { color: colors.gold }]}>{o.cents > 0 ? `€${(o.cents / 100).toFixed(0)}` : '—'}</Text>
          </View>
        ))}
        {owed.size === 0 ? <Body muted>No rounds settled yet. The first ledger runs Sunday at 21:00.</Body> : null}
      </ScrollView>
      <Body muted style={{ fontSize: 12.5 }}>Pot is a ledger, not a charge. The squad votes what it becomes on 31 Dec.</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontFamily: fonts.body, fontWeight: '600', fontSize: 14.5, color: colors.ink },
  amount: { fontFamily: fonts.display, fontWeight: '900', fontSize: 22, color: colors.ink3 },
});
