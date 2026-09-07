import { Alert, ScrollView, StyleSheet, Switch, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { HABITS, HABIT_KEYS, buildContract, type ContractLine } from '@winarc/domain';
import { Body, Button, Chip, Display, Eyebrow, Screen } from '@/components/ui';
import { useOnboarding } from '@/state/arc';
import { colors, fonts } from '@/theme/tokens';

export default function Contract() {
  const ob = useOnboarding();

  /** Product rule 2: under-18s cannot set weight tracking. Asked once, stored on the profile at signing. */
  function confirmAdult() {
    if (ob.adult) return ob.setWeighIn(true);
    Alert.alert('The weigh-in is for adults', 'Under-18s cannot set weight tracking. Are you 18 or older?', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: "I'm 18 or older",
        onPress: () => {
          ob.setAdult(true);
          ob.setWeighIn(true);
        },
      },
    ]);
  }
  let lines: ContractLine[] = [];
  let error: string | null = null;
  try {
    lines = buildContract(ob.contractInput());
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <Screen>
      <Eyebrow>02 · Contract</Eyebrow>
      <Display size={30}>
        Three to five lines.{'\n'}
        <Text style={{ color: colors.ink2 }}>Nothing you can't screenshot.</Text>
      </Display>
      <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {error ? <Body style={{ color: colors.rose }}>{error}</Body> : null}
        {lines.map((l) => (
          <View key={l.key} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.name}</Text>
              <Text style={styles.ver}>
                {l.verification.replace('_', ' + ')} · {l.staked ? 'staked' : 'private, never staked'}
              </Text>
            </View>
            {l.kind === 'body' ? (
              <Switch value={ob.weighIn} onValueChange={(on) => (on ? confirmAdult() : ob.setWeighIn(false))} trackColor={{ true: colors.ice }} />
            ) : (
              <View style={styles.step}>
                <Pressable onPress={() => ob.setPerWeek(l.key, l.perWeek - 1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.val}>{l.perWeek}</Text>
                <Pressable onPress={() => ob.setPerWeek(l.key, l.perWeek + 1)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
        {!ob.weighIn ? (
          <View style={[styles.line, { opacity: 0.55 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Weekly weigh-in</Text>
              <Text style={styles.ver}>off · turn on to track privately</Text>
            </View>
            <Switch value={false} onValueChange={(on) => (on ? confirmAdult() : ob.setWeighIn(false))} />
          </View>
        ) : null}
        <Eyebrow>Mind &amp; money · max 2 · {ob.habits.length} picked</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {HABIT_KEYS.map((k) => (
            <Chip key={k} label={HABITS[k]!.name} on={ob.habits.includes(k)} onPress={() => ob.toggleHabit(k)} />
          ))}
          {ob.customHabits.map((c) => (
            <Chip key={c.key} label={c.name} on={ob.habits.includes(c.key)} onPress={() => ob.toggleHabit(c.key)} />
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Find my squad" disabled={!!error} onPress={() => router.push('/(onboarding)/squad')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 12 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  ver: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink2, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, padding: 4 },
  stepBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.ink, fontSize: 18 },
  val: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, width: 36, textAlign: 'center' },
});
