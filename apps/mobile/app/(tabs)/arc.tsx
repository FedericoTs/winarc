import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EPISODE_DAYS, addDays, dayOfSeason, episodeWindow, localISODate, type EpisodeNumber, type EpisodeStats } from '@winarc/domain';
import { season } from '@/lib/season';
import { Body, Button, Display, Eyebrow, Screen } from '@/components/ui';
import { EpisodeCard, type CardRef } from '@/components/cards';
import { shareCard } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const NUMBERS: EpisodeNumber[] = [1, 2, 3];

type EpisodeRow = { number: EpisodeNumber; title: string; stats: EpisodeStats & { line?: string } };

/**
 * Episodes land at days 30, 60 and 90. The member's device asks for the
 * title the first time the tab opens after the day arrives; the card is
 * rendered here from the stored stats and shared like every other card.
 */
export default function Arc() {
  const today = localISODate(new Date(), tz);
  const day = dayOfSeason(today, season());
  const [episodes, setEpisodes] = useState<Partial<Record<EpisodeNumber, EpisodeRow>>>({});
  const [squad, setSquad] = useState<{ name: string; code: string } | null>(null);
  const [busy, setBusy] = useState<EpisodeNumber | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cards = useRef<Partial<Record<EpisodeNumber, CardRef | null>>>({});

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from('episodes').select('number, title, stats').eq('profile_id', auth.user.id);
      const next: Partial<Record<EpisodeNumber, EpisodeRow>> = {};
      for (const row of (data as EpisodeRow[] | null) ?? []) next[row.number] = row;
      setEpisodes(next);
      const { data: m } = await supabase.from('squad_members').select('squads(name, code)').eq('profile_id', auth.user.id).is('left_at', null).maybeSingle();
      const s = (m as { squads: { name: string; code: string } | { name: string; code: string }[] | null } | null)?.squads;
      const one = Array.isArray(s) ? s[0] : s;
      if (one) setSquad({ name: one.name, code: one.code });
    })();
  }, []);

  async function render(n: EpisodeNumber) {
    setBusy(n);
    setError(null);
    const { data, error: e } = await supabase.functions.invoke('title-episode', { body: { number: n } });
    setBusy(null);
    if (e) return setError(e.message);
    if (data?.error) return setError(data.error === 'not yet' ? `Episode ${n} unlocks on day ${data.unlocks_on_day}.` : data.error);
    setEpisodes((prev) => ({ ...prev, [n]: data.episode as EpisodeRow }));
    if (!data.existing) track({ name: 'episode_created', number: n, fallback: !!data.fallback });
  }

  async function share(n: EpisodeNumber) {
    const ref = cards.current[n];
    if (!ref) return;
    try {
      const result = await shareCard({ current: ref }, `Episode ${n} of my winter arc on WinArc${squad?.code ? ` · join ${squad.code}` : ''}`);
      track({ name: 'episode_shared', number: n, result });
    } catch {
      track({ name: 'episode_shared', number: n, result: 'failed' });
    }
  }

  return (
    <Screen>
      <Eyebrow>Your arc</Eyebrow>
      <Display size={36}>Episodes</Display>
      {NUMBERS.map((n) => {
        const at = EPISODE_DAYS[n - 1];
        const date = addDays(season().startsOn, at - 1);
        const ep = episodes[n];
        const unlocked = day >= at;
        const w = episodeWindow(n);
        return (
          <View key={n} style={[styles.ep, ep && { borderColor: colors.ember }]}>
            <Text style={styles.epEyebrow}>
              Episode {n} · day {at} · {date}
            </Text>
            {ep ? (
              <>
                <View style={{ position: 'absolute', left: -2000, top: 0 }} pointerEvents="none">
                  <EpisodeCard
                    ref={(r) => {
                      cards.current[n] = r;
                    }}
                    number={n}
                    fromDay={w.fromDay}
                    toDay={w.toDay}
                    proofs={ep.stats.proofs}
                    title={ep.title}
                    line={ep.stats.line ?? ''}
                    bestStreak={ep.stats.best_streak}
                    squadName={squad?.name ?? 'My squad'}
                    code={squad?.code ?? null}
                  />
                </View>
                <Text style={styles.title}>{ep.title}</Text>
                <Text style={styles.line}>{ep.stats.line}</Text>
                <Text style={styles.stats}>
                  <Text style={{ color: colors.ember }}>{ep.stats.proofs}</Text> proofs · <Text style={{ color: colors.ink }}>{ep.stats.best_streak}</Text> best streak ·{' '}
                  <Text style={{ color: colors.rose }}>{ep.stats.misses}</Text> missed
                </Text>
                <Button title={`Share episode ${n}`} onPress={() => share(n)} />
              </>
            ) : unlocked ? (
              <Button title={busy === n ? 'Titling…' : `Render episode ${n}`} disabled={busy !== null} onPress={() => render(n)} />
            ) : (
              <Body muted>Unlocks on {date}. Rendered from your own proofs, titled in arc language.</Body>
            )}
          </View>
        );
      })}
      {error ? <Body style={{ color: colors.rose }}>{error}</Body> : null}
      <Body style={{ color: colors.ink2, fontSize: 12.5 }}>The finale on {season().finaleOn} adds the certificate, the season stats and the pot vote.</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ep: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, gap: 8 },
  epEyebrow: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink2 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, textTransform: 'uppercase', color: colors.ink },
  line: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2 },
  stats: { fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 0.8, color: colors.ink2 },
});
