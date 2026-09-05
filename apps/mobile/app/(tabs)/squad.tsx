import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SEASON_ONE, addDays, dayOfSeason, localISODate, type DayMark } from '@winarc/domain';
import { Body, Eyebrow, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAYS = 12;

type MarkRow = { profile_id: string; local_date: string; mark: DayMark; profiles: { display_name: string } | null };

const CELL: Record<DayMark, { bg?: string; border?: string; fg: string; glyph: string }> = {
  V: { bg: colors.ember, fg: '#160B02', glyph: '✓' },
  B: { bg: colors.mint, fg: '#06281B', glyph: '✓' },
  X: { border: colors.rose, fg: colors.rose, glyph: '✕' },
  R: { bg: colors.surface2, fg: colors.ink3, glyph: '–' },
  S: { bg: colors.surface2, fg: colors.ink3, glyph: 's' },
  P: { border: colors.ice, fg: colors.ice, glyph: '·' },
};

/** Faces, not charts: members by day, glyph plus color on every cell. */
export default function SquadBoard() {
  const [rows, setRows] = useState<MarkRow[]>([]);
  const today = localISODate(new Date(), tz);
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i - (DAYS - 1)));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('day_marks')
        .select('profile_id, local_date, mark, profiles(display_name)')
        .gte('local_date', dates[0]!)
        .lte('local_date', today);
      setRows((data as MarkRow[] | null) ?? []);
    })();
  }, [today]);

  const members = [...new Map(rows.map((r) => [r.profile_id, r.profiles?.display_name ?? 'Member'])).entries()];

  return (
    <Screen>
      <Eyebrow>Squad board · squad only</Eyebrow>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.row}>
            <View style={styles.name} />
            {dates.map((d) => (
              <Text key={d} style={[styles.dh, d === today && { color: colors.ice }]}>
                {Math.max(0, dayOfSeason(d, SEASON_ONE))}
              </Text>
            ))}
          </View>
          {members.map(([id, name]) => (
            <View key={id} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              {dates.map((d) => {
                const marks = rows.filter((r) => r.profile_id === id && r.local_date === d).map((r) => r.mark);
                const mark: DayMark = marks.includes('X') ? 'X' : marks.includes('P') ? 'P' : marks.includes('V') ? 'V' : marks.includes('B') ? 'B' : marks.includes('S') ? 'S' : 'R';
                const c = CELL[mark];
                return (
                  <View key={d} style={[styles.cell, { backgroundColor: c.bg ?? 'transparent', borderColor: c.border ?? 'transparent' }]}>
                    <Text style={{ color: c.fg, fontFamily: fonts.mono, fontSize: 11, fontWeight: '600' }}>{c.glyph}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {members.length === 0 ? <Body muted>No marks yet. The board fills in from Day 1.</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  name: { width: 56, fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink2 },
  dh: { width: 24, textAlign: 'center', fontFamily: fonts.mono, fontSize: 9.5, color: colors.ink3 },
  cell: { width: 24, height: 24, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
