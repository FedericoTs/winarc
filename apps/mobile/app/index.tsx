import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { dayOfSeason, localISODate } from '@winarc/domain';
import { season } from '@/lib/season';
import { Body, Button, Eyebrow, Screen, Tile } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function countdown(now: Date) {
  // Local midnight of the start date on this device.
  const [yy, mm, dd] = season().startsOn.split('-').map(Number) as [number, number, number];
  const start = new Date(yy, mm - 1, dd).getTime();
  const diff = start - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const rest = diff - days * 86_400_000;
  const h = Math.floor(rest / 3_600_000);
  const m = Math.floor((rest % 3_600_000) / 60_000);
  const s = Math.floor((rest % 60_000) / 1000);
  return { days, clock: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function Countdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cd = countdown(now);
  const day = dayOfSeason(localISODate(now, tz), season());

  return (
    <Screen style={{ justifyContent: 'flex-end', paddingBottom: 28 }}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>WINARC</Text>
        <Eyebrow>Season one · {season().id}</Eyebrow>
      </View>
      <View style={{ gap: 2 }}>
        <Eyebrow color={colors.ice}>{cd ? 'Your arc starts in' : 'Season one · live'}</Eyebrow>
        <Text style={styles.big}>{cd ? cd.days : Math.min(day, season().arcDays)}</Text>
        <Text style={styles.unit}>{cd ? (cd.days === 1 ? 'day' : 'days') : `of ${season().arcDays}`}</Text>
        {cd ? <Text style={styles.clock}>{cd.clock}</Text> : null}
        <Text style={styles.range}>01 OCT → 29 DEC 2026</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile value="90" label="days, one cohort" />
        <Tile value="2–8" label="people per squad" />
        <Tile value="€" label="misses feed the pot" color={colors.gold} />
      </View>
      <Button title="Start your arc" onPress={() => router.push('/(onboarding)/sports')} />
      <Body muted style={{ fontSize: 12.5 }}>
        Squads lock {season().locksOn}. No feed. No coach. Just proof.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'auto', marginTop: 8 },
  wordmark: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 2, color: colors.ink },
  big: { fontFamily: fonts.display, fontSize: 172, lineHeight: 141, letterSpacing: -1.7, color: colors.ink, marginLeft: -4 },
  unit: { fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: 2, color: colors.ink2, textTransform: 'uppercase' },
  clock: { fontFamily: fonts.mono, fontSize: 22, color: colors.ice, letterSpacing: 1.5, marginTop: 6 },
  range: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.5, color: colors.ink2, marginTop: 2 },
});
