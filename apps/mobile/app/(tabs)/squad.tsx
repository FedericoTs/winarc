import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SEASON_ONE, addDays, dayOfSeason, localISODate, rollupMark, type DayMark } from '@winarc/domain';
import { Body, Eyebrow, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAYS = 12;
const THUMB_TTL_SECONDS = 3600;

type MarkRow = { profile_id: string; local_date: string; mark: DayMark; profiles: { display_name: string } | null };
type VouchRequest = { id: string; proof_id: string; profile_id: string; local_date: string; profiles: { display_name: string } | null };
type ProofRow = { profile_id: string; front_path: string | null; rear_path: string | null; tier: string | null; profiles: { display_name: string } | null };
type Thumb = { id: string; name: string; tier: string; uri: string };

const CELL: Record<DayMark, { bg?: string; border?: string; fg: string; glyph: string }> = {
  V: { bg: colors.ember, fg: '#160B02', glyph: '✓' },
  B: { bg: colors.mint, fg: '#06281B', glyph: '✓' },
  X: { border: colors.rose, fg: colors.rose, glyph: '✕' },
  R: { bg: colors.surface2, fg: colors.ink3, glyph: '–' },
  S: { bg: colors.surface2, fg: colors.ink3, glyph: 's' },
  P: { border: colors.ice, fg: colors.ice, glyph: '·' },
};

/** Faces, not charts: today's stamped proofs as thumbnails, then members by day with glyph plus color on every cell. */
export default function SquadBoard() {
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [requests, setRequests] = useState<VouchRequest[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
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
      const { data: auth } = await supabase.auth.getUser();
      setMe(auth.user?.id ?? null);
      const { data: r } = await supabase
        .from('rescues')
        .select('id, proof_id, profile_id, local_date, profiles(display_name)')
        .eq('kind', 'vouch_request')
        .is('resolved_at', null);
      setRequests(((r as VouchRequest[] | null) ?? []).filter((x) => x.profile_id !== auth.user?.id));

      // Today's stamped proofs. Squadmates may read each other's proof images; the URLs are signed and short-lived.
      const { data: p } = await supabase
        .from('proofs')
        .select('profile_id, front_path, rear_path, tier, profiles(display_name)')
        .eq('local_date', today)
        .in('status', ['verified', 'vouched', 'attested']);
      const proofs = (p as ProofRow[] | null) ?? [];
      const paths = proofs.map((x) => x.front_path ?? x.rear_path).filter((x): x is string => !!x);
      const { data: signed } = paths.length ? await supabase.storage.from('proofs').createSignedUrls(paths, THUMB_TTL_SECONDS) : { data: null };
      const byPath = new Map((signed ?? []).filter((s) => s.path && !s.error).map((s) => [s.path as string, s.signedUrl]));
      setThumbs(
        proofs.flatMap((x) => {
          const path = x.front_path ?? x.rear_path;
          const uri = path ? byPath.get(path) : undefined;
          return uri ? [{ id: x.profile_id, name: x.profiles?.display_name ?? 'Member', tier: x.tier ?? 'SILVER', uri }] : [];
        }),
      );
    })();
  }, [today, refresh]);

  async function vouch(proofId: string) {
    const { error } = await supabase.from('vouches').insert({ proof_id: proofId, voucher_id: me });
    if (!error) track({ name: 'vouched' });
    setRefresh((k) => k + 1);
  }

  const members = [...new Map(rows.map((r) => [r.profile_id, r.profiles?.display_name ?? 'Member'])).entries()];

  return (
    <Screen>
      <Eyebrow>Squad board · squad only</Eyebrow>
      {thumbs.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow color={colors.ember}>Today's proofs</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {thumbs.map((t) => (
              <View key={t.id} style={{ width: 72, gap: 3 }}>
                <Image source={{ uri: t.uri }} style={styles.thumb} contentFit="cover" transition={150} accessibilityLabel={`${t.name}'s proof`} />
                <Text style={styles.thumbName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={[styles.thumbTier, { color: t.tier === 'BRONZE' ? colors.mint : colors.ember }]}>{t.tier}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
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
                const mark = rollupMark(rows.filter((r) => r.profile_id === id && r.local_date === d).map((r) => r.mark));
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
      {requests.length ? (
        <View style={{ gap: 8 }}>
          <Eyebrow>Vouch requests · two squadmates make it Bronze</Eyebrow>
          {requests.map((r) => (
            <View key={r.id} style={styles.request}>
              <Text style={styles.requestText}>
                {r.profiles?.display_name ?? 'A squadmate'} trained on {r.local_date} and asks you to confirm it.
              </Text>
              <Pressable onPress={() => vouch(r.proof_id)} style={styles.vouchBtn}>
                <Text style={styles.vouchText}>Vouch</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  name: { width: 56, fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink2 },
  dh: { width: 24, textAlign: 'center', fontFamily: fonts.mono, fontSize: 9.5, color: colors.ink3 },
  cell: { width: 24, height: 24, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 72, height: 96, borderRadius: 12, backgroundColor: colors.surface2 },
  thumbName: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink },
  thumbTier: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  request: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  requestText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.ink },
  vouchBtn: { backgroundColor: colors.mint, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  vouchText: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, color: '#06281B' },
});
