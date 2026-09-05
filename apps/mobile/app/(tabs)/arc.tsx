import { EPISODE_DAYS, SEASON_ONE, addDays } from '@arc/domain';
import { Body, Display, Eyebrow, Screen } from '@/components/ui';
import { colors } from '@/theme/tokens';

/** Episodes land at days 30, 60 and 90. Titled by the model from the member's own proofs. */
export default function Arc() {
  return (
    <Screen>
      <Eyebrow>Your arc</Eyebrow>
      <Display size={36}>Episodes</Display>
      {EPISODE_DAYS.map((d, i) => (
        <Body key={d} muted>
          Episode {i + 1} · day {d} · {addDays(SEASON_ONE.startsOn, d - 1)}
        </Body>
      ))}
      <Body style={{ color: colors.ink2, fontSize: 12.5 }}>The finale on {SEASON_ONE.finaleOn} adds the certificate, the season stats and the pot vote.</Body>
    </Screen>
  );
}
