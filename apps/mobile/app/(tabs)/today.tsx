import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RESCUE, SEASON_ONE, dayOfSeason, localISODate, sickDaysLeft, vouchesLeft } from '@winarc/domain';
import { Body, Button, Eyebrow, Screen, Tile } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Due = { id: string; contract_line_id: string; mark: string; contract_lines: { name: string; verification: string } | null };

export default function Today() {
  const [now, setNow] = useState(new Date());
  const [due, setDue] = useState<Due[]>([]);
  const [rescues, setRescues] = useState({ sick: 0, vouch: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  function cantTrain() {
    Alert.alert("Can't train today?", 'Three honest options. None of them reset your arc.', [
      {
        text: `Use a sick day (${sickDaysLeft(rescues.sick)} left)`,
        onPress: async () => {
          const { error } = await supabase.rpc('use_sick_day');
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
        title={done ? 'Proved. See the squad' : open ? 'Prove it' : 'Train anyway'}
        variant={open ? 'primary' : 'ghost'}
        onPress={() => (done ? router.push('/(tabs)/squad') : router.push({ pathname: '/proof', params: { line: open?.contract_line_id ?? '' } }))}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile value={String(Math.max(0, day))} label="day arc" />
        <Tile value="–" label="squad streak" color={colors.ember} />
        <Tile value="–" label="in the pot" color={colors.gold} />
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
  what: { fontFamily: fonts.display, fontWeight: '900', fontSize: 40, lineHeight: 38, textTransform: 'uppercase', color: colors.ink },
  cd: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 1.5, color: colors.ice },
  rescueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  rescue: { flex: 1, fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 17, color: colors.ink2 },
  link: { fontFamily: fonts.body, fontWeight: '600', fontSize: 13, color: colors.ice },
});
