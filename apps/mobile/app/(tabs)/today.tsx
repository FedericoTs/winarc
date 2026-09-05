import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  RESCUE,
  SEASON_ONE,
  WEIGH_KEY,
  addDays,
  dayOfSeason,
  formatStake,
  isWeighDay,
  localISODate,
  rollupMark,
  sickDaysLeft,
  squadStreak,
  vouchesLeft,
  weekdayOf,
  type Currency,
  type DayMark,
} from '@winarc/domain';
import { Body, Button, Eyebrow, Screen, Tile } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const STREAK_WINDOW = 30;

type Due = { id: string; contract_line_id: string; mark: string; contract_lines: { name: string; verification: string } | null };
type MarkRow = { profile_id: string; local_date: string; mark: DayMark };

export default function Today() {
  const [now, setNow] = useState(new Date());
  const [due, setDue] = useState<Due[]>([]);
  const [rescues, setRescues] = useState({ sick: 0, vouch: 0 });
  const [stats, setStats] = useState<{ streak: number; potCents: number; currency: Currency }>({ streak: 0, potCents: 0, currency: 'EUR' });
  const [weighDay, setWeighDay] = useState(false);
  const [firstSportLine, setFirstSportLine] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function cantTrain() {
    Alert.alert("Can't train today?", 'Three honest options. None of them reset your arc.', [
      {
        text: `Use a sick day (${sickDaysLeft(rescues.sick)} left)`,
        onPress: async () => {
          const { error } = await supabase.rpc('use_sick_day');
          track({ name: 'sick_day_used', ok: !error });
          Alert.alert(error ? "Couldn't use a sick day" : 'Rest day', error ? error.message : 'Today is a rest day. The squad is told.');
          setReloadKey((k) => k + 1);
        },
      },
      { text: 'Take the miss', style: 'destructive', onPress: () => Alert.alert('Noted', 'The day closes as a miss at 23:59. Your arc continues tomorrow.') },
      { text: "Never mind, I'm going", style: 'cancel' },
    ]);
  }
  const today = localISODate(now, tz);
  const day = dayOfSeason(today, SEASON_ONE);

  /** Sport lines take the dual-cam ritual; mind and money lines are witnessed by the squad. */
  function proveLabel(v?: string): string {
    return v === 'attest' ? 'I did it' : v === 'photo' || v === 'artifact' ? 'Add a photo' : 'Prove it';
  }
  function prove(line: Due) {
    const v = line.contract_lines?.verification;
    if (v === 'attest') {
      Alert.alert(line.contract_lines?.name ?? 'Done today?', 'Your word, on the board where the squad can see it. Stamps Bronze.', [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'I did it',
          onPress: async () => {
            const { error } = await supabase.rpc('attest_today', { p_line: line.contract_line_id });
            if (error) Alert.alert("Couldn't stamp it", error.message);
            else track({ name: 'habit_attested', verification: 'attest' });
            setReloadKey((k) => k + 1);
          },
        },
      ]);
      return;
    }
    if (v === 'photo' || v === 'artifact') return router.push({ pathname: '/attest', params: { line: line.contract_line_id } });
    router.push({ pathname: '/proof', params: { line: line.contract_line_id } });
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from('day_marks')
        .select('id, contract_line_id, mark, contract_lines(name, verification)')
        .eq('profile_id', auth.user.id)
        .eq('local_date', today);
      setDue((data as Due[] | null) ?? []);
      const { data: r } = await supabase.from('rescues').select('kind').eq('profile_id', auth.user.id).gte('local_date', today.slice(0, 8) + '01');
      const sick = (r ?? []).filter((x) => x.kind === 'sick').length;
      const vouch = (r ?? []).filter((x) => x.kind === 'vouch_request').length;
      setRescues({ sick, vouch });

      // Squad streak from the board's own marks, pot from the ledger. Row-level security scopes both to the home squad.
      const since = addDays(today, -(STREAK_WINDOW - 1));
      const { data: marks } = await supabase.from('day_marks').select('profile_id, local_date, mark').gte('local_date', since).lte('local_date', today);
      const perDay = new Map<string, Map<string, DayMark[]>>();
      for (const m of (marks as MarkRow[] | null) ?? []) {
        const members = perDay.get(m.local_date) ?? new Map<string, DayMark[]>();
        members.set(m.profile_id, [...(members.get(m.profile_id) ?? []), m.mark]);
        perDay.set(m.local_date, members);
      }
      const days: DayMark[][] = [];
      for (let i = 0; i < STREAK_WINDOW; i++) {
        const d = addDays(since, i);
        const rolled = [...(perDay.get(d)?.values() ?? [])].map(rollupMark);
        if (d === today && rolled.includes('P')) continue; // today counts once everyone is in
        days.push(rolled);
      }
      const { data: ledger } = await supabase.from('ledger_entries').select('amount_cents');
      const { data: sm } = await supabase.from('squad_members').select('squads(currency)').eq('profile_id', auth.user.id).is('left_at', null).maybeSingle();
      const sq = (sm as { squads: { currency: Currency } | { currency: Currency }[] | null } | null)?.squads;
      const currency = (Array.isArray(sq) ? sq[0]?.currency : sq?.currency) ?? 'EUR';
      setStats({ streak: squadStreak(days), potCents: (ledger ?? []).reduce((a, e) => a + (e.amount_cents as number), 0), currency });

      // The weigh-in is unstaked, so it never opens a mark; Today shows a private row on its day.
      const { data: contract } = await supabase.from('contracts').select('id').eq('profile_id', auth.user.id).eq('season_id', SEASON_ONE.id).maybeSingle();
      if (contract) {
        const { data: weigh } = await supabase.from('contract_lines').select('days').eq('contract_id', contract.id).eq('key', WEIGH_KEY).maybeSingle();
        setWeighDay(!!weigh && isWeighDay(weigh.days as number[], weekdayOf(today)));
        // An extra session on a rest day attaches to the first sport line and shows on the board; it is never owed.
        const { data: sport } = await supabase.from('contract_lines').select('id').eq('contract_id', contract.id).eq('kind', 'sport').order('position').limit(1).maybeSingle();
        setFirstSportLine(sport?.id ?? null);
      }
    })();
  }, [today, reloadKey]);

  const open = due.find((d) => d.mark === 'P');
  const done = due.find((d) => d.mark === 'V' || d.mark === 'B');
  const sick = due.find((d) => d.mark === 'S');
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const left = Math.max(0, end.getTime() - now.getTime());
  const clock = `${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`;

  return (
    <Screen>
      <View style={styles.slate}>
        <Text style={styles.slateText}>
          <Text style={{ color: colors.ink }}>{SEASON_ONE.id}</Text> · Day {Math.max(0, day)} / {SEASON_ONE.arcDays}
        </Text>
        <Text style={styles.slateText}>{today}</Text>
      </View>
      <View style={[styles.due, done && { borderColor: colors.ember }]}>
        <Eyebrow>{done ? 'Done' : open ? 'Due today' : sick ? 'Rest · sick day' : 'Rest day'}</Eyebrow>
        <Text style={styles.what}>{open?.contract_lines?.name ?? done?.contract_lines?.name ?? 'Nothing due'}</Text>
        <Text style={[styles.cd, done && { color: colors.ember }]}>{done ? 'Stamped' : open ? clock : sick ? 'Squad told' : 'Nothing owed'}</Text>
        <View style={styles.rescueRow}>
          <Text style={styles.rescue}>
            <Text style={{ color: colors.ink }}>{sickDaysLeft(rescues.sick)}</Text> sick day · <Text style={{ color: colors.ink }}>{vouchesLeft(rescues.vouch)}</Text> vouch left · a miss costs the stake, never your arc
          </Text>
          {open ? (
            <Pressable onPress={cantTrain} hitSlop={8}>
              <Text style={styles.link}>Can't train?</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Button
        title={done ? 'Proved. See the squad' : open ? proveLabel(open.contract_lines?.verification) : 'Train anyway'}
        variant={open ? 'primary' : 'ghost'}
        disabled={!done && !open && !firstSportLine}
        onPress={() => (done ? router.push('/(tabs)/squad') : open ? prove(open) : router.push({ pathname: '/proof', params: { line: firstSportLine ?? '' } }))}
      />
      {weighDay ? (
        <Pressable onPress={() => router.push('/weigh')} style={styles.weigh} accessibilityRole="button">
          <View style={{ flex: 1, gap: 2 }}>
            <Eyebrow color={colors.lilac}>Weigh-in day · private</Eyebrow>
            <Text style={styles.weighText}>Never staked, never on the board. Health reading or type it.</Text>
          </View>
          <Text style={styles.link}>Weigh in</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile value={String(Math.max(0, day))} label="day arc" />
        <Tile value={String(stats.streak)} label="squad streak" color={colors.ember} />
        <Tile value={formatStake(stats.potCents, stats.currency)} label="in the pot" color={colors.gold} />
      </View>
      <Body muted style={{ fontSize: 12.5 }}>
        Rescue rules: {RESCUE.sickDaysPerFortnight} sick day per fortnight, {RESCUE.vouchesPerWeek} vouch per week.
      </Body>
    </Screen>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

const styles = StyleSheet.create({
  slate: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  slateText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink2 },
  due: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, gap: 8 },
  what: { fontFamily: fonts.display, fontSize: 40, lineHeight: 38, textTransform: 'uppercase', color: colors.ink },
  cd: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 1.5, color: colors.ice },
  rescueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  rescue: { flex: 1, fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 17, color: colors.ink2 },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ice },
  weigh: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 },
  weighText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink2 },
});
