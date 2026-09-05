import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { formatDelta, validKg, weighTrend, type WeighIn } from '@winarc/domain';
import { Body, Button, Display, Eyebrow, Screen, Tile } from '@/components/ui';
import { health } from '@/lib/health';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

type Source = 'healthkit' | 'health_connect' | 'manual';
type Reading = { kg: number; at: string; source: Source };
type LogRow = { delta_kg: string | number; readings: number };

/**
 * The weekly weigh-in. Private, optional, never staked. A Health reading when
 * there is one, a typed number otherwise. The only number shown back is the
 * change since the first reading; there is no target anywhere.
 */
export default function Weigh() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<WeighIn[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        if (await health.available()) {
          await health.requestRead();
          const latest = await health.latestWeightKg();
          if (latest) setReading({ ...latest, source: Platform.OS === 'ios' ? 'healthkit' : 'health_connect' });
        }
      } catch {
        // No Health reading; the typed path still works.
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('weigh_ins').select('local_date, kg').order('local_date', { ascending: true });
      setHistory(((data as { local_date: string; kg: string | number }[] | null) ?? []).map((r) => ({ date: r.local_date, kg: Number(r.kg) })));
    })();
  }, [reload]);

  async function log(kg: number, source: Source) {
    if (!validKg(kg)) return setError('That does not look like a body weight in kg.');
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('log_weigh_in', { p_kg: kg, p_source: source });
    setBusy(false);
    if (e) return setError(e.message);
    const row = (Array.isArray(data) ? data[0] : data) as LogRow | undefined;
    const readings = row?.readings ?? 1;
    setDone(readings > 1 ? `${formatDelta(Number(row?.delta_kg ?? 0))} since your first weigh-in.` : 'First reading logged. The trend starts next week.');
    setReload((k) => k + 1);
  }

  const trend = weighTrend(history);
  const typedKg = Number(typed.replace(',', '.'));
  const when = reading ? new Date(reading.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Screen>
      <Eyebrow color={colors.lilac}>Weigh-in · private · never staked</Eyebrow>
      <Display size={36}>Your number{'\n'}stays yours.</Display>
      <Body muted>Weekly, optional, and never on a squad surface. The only thing WinArc computes is the change since your first reading.</Body>

      {reading ? (
        <View style={styles.box}>
          <Text style={styles.label}>From Health · {when}</Text>
          <Text style={styles.big}>{reading.kg.toFixed(1)} kg</Text>
          <Button title="Log this reading" disabled={busy} onPress={() => log(Number(reading.kg.toFixed(2)), reading.source)} />
        </View>
      ) : null}

      <View style={styles.box}>
        <Text style={styles.label}>{reading ? 'Or type it' : 'Type your reading'}</Text>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          keyboardType="decimal-pad"
          placeholder="82.4"
          placeholderTextColor={colors.ink3}
          style={styles.input}
          accessibilityLabel="Weight in kilograms"
        />
        <Button title="Log it" variant={reading ? 'ghost' : 'primary'} disabled={busy || !validKg(typedKg)} onPress={() => log(typedKg, 'manual')} />
      </View>

      {done ? <Body style={{ color: colors.mint }}>{done}</Body> : null}
      {error ? <Body style={{ color: colors.rose }}>{error}</Body> : null}

      {trend.readings > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile value={trend.latest ? trend.latest.kg.toFixed(1) : '–'} label="latest kg" />
          <Tile value={trend.readings > 1 ? formatDelta(trend.deltaKg) : '–'} label="since day 1" color={colors.lilac} />
          <Tile value={String(trend.readings)} label="readings" />
        </View>
      ) : null}

      <View style={{ marginTop: 'auto', paddingBottom: 12 }}>
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 10 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink2 },
  big: { fontFamily: fonts.display, fontWeight: '900', fontSize: 44, lineHeight: 46, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground, borderRadius: 12, padding: 12, color: colors.ink, fontSize: 22, fontFamily: fonts.mono },
});
