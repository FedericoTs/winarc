import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ContractLine, Tier } from '@winarc/domain';
import { colors, fonts } from '@/theme/tokens';

/**
 * Share cards. Laid out at 360 by 640 and captured at 1080 by 1920. Each
 * passes the screenshot test: one number, identity, squad, watermark with the
 * join code, readable at thumbnail size.
 */

const W = 360;
const H = 640;

export interface PosterCardProps {
  lines: ContractLine[];
  stakeLabel: string;
  squadName: string;
  code: string | null;
  spots: string;
  locksOn: string;
  signedOn: string;
}

export type CardRef = ComponentRef<typeof View>;

export const PosterCard = forwardRef<CardRef, PosterCardProps>(function PosterCard(p, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Text style={styles.ey}>Season one · S01 · signed {p.signedOn}</Text>
      <Text style={[styles.big, { fontSize: 58, marginTop: 10 }]}>Arc{'\n'}contract</Text>
      <View style={{ marginTop: 16, gap: 6 }}>
        {p.lines.slice(0, 5).map((l) => (
          <View key={l.key} style={styles.line}>
            <Text style={styles.lineText}>
              {l.perWeek}× {l.name}
            </Text>
            <Text style={styles.lineTag}>{l.staked ? 'staked' : 'private'}</Text>
          </View>
        ))}
        <View style={styles.line}>
          <Text style={[styles.lineText, { color: colors.gold }]}>{p.stakeLabel} per miss</Text>
          <Text style={[styles.lineTag, { color: colors.gold }]}>squad pot</Text>
        </View>
      </View>
      <View style={styles.join}>
        <Text style={styles.joinText}>{p.code ? `Join my squad · ${p.code}` : 'Squad forming'}</Text>
        <Text style={styles.joinText}>
          {p.spots} · locks {p.locksOn}
        </Text>
      </View>
      <Watermark squad={p.squadName} code={p.code} extra="starts 01 Oct · signed on glass" />
    </View>
  );
});

export interface ProofCardProps {
  day: number;
  arcDays: number;
  time: string;
  sportWord: string;
  tier: Tier;
  evidence: string;
  provedToday: string;
  squadName: string;
  code: string | null;
}

export const ProofCard = forwardRef<CardRef, ProofCardProps>(function ProofCard(p, ref) {
  const bronze = p.tier === 'BRONZE';
  const color = bronze ? colors.mint : colors.ember;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: '#10141C' }]}>
      <View style={styles.row}>
        <Text style={[styles.ey, { color: colors.ink }]}>
          Day {p.day} / {p.arcDays}
        </Text>
        <Text style={[styles.ey, { color: colors.ink }]}>{p.time}</Text>
      </View>
      <View style={{ position: 'absolute', left: 22, bottom: 150 }}>
        <View style={[styles.stamp, { borderColor: color }]}>
          <Text style={[styles.stampText, { color }]}>{bronze ? 'Vouched' : 'Verified'}</Text>
        </View>
        <Text style={[styles.ey, { color: colors.ink, marginTop: 12 }]}>
          {p.sportWord} · {p.evidence} · {p.tier}
        </Text>
        <Text style={[styles.ey, { marginTop: 4 }]}>{p.provedToday}</Text>
      </View>
      <Watermark squad={p.squadName} code={p.code} />
    </View>
  );
});

function Watermark({ squad, code, extra }: { squad: string; code: string | null; extra?: string }) {
  return (
    <View style={styles.wm}>
      <Text style={styles.wmText}>
        <Text style={{ color: colors.ink }}>WINARC</Text> · S01 · {squad}
        {code ? <Text style={{ color: colors.ice }}> · join {code}</Text> : null}
      </Text>
      {extra ? <Text style={styles.wmText}>{extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: W, height: H, backgroundColor: colors.surface, borderRadius: 0, padding: 26, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ey: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.8, textTransform: 'uppercase', color: colors.ink2 },
  big: { fontFamily: fonts.display, textTransform: 'uppercase', lineHeight: 52, color: colors.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 5 },
  lineText: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink },
  lineTag: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink2 },
  join: { marginTop: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ice, borderRadius: 12, padding: 12, gap: 4 },
  joinText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.ice },
  stamp: { alignSelf: 'flex-start', borderWidth: 5, borderRadius: 12, paddingHorizontal: 12, paddingTop: 4, transform: [{ rotate: '-6deg' }], backgroundColor: 'rgba(11,13,18,0.35)' },
  stampText: { fontFamily: fonts.display, fontSize: 46, letterSpacing: 3, lineHeight: 46, textTransform: 'uppercase' },
  wm: { position: 'absolute', left: 22, right: 22, bottom: 20, gap: 2 },
  wmText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: colors.ink2 },
});

export interface EpisodeCardProps {
  number: number;
  fromDay: number;
  toDay: number;
  proofs: number;
  title: string;
  line: string;
  bestStreak: number;
  squadName: string;
  code: string | null;
}

/** One number (proofs), the title as identity, the streak as the squad line, code and episode in the watermark. */
export const EpisodeCard = forwardRef<CardRef, EpisodeCardProps>(function EpisodeCard(p, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: '#0F1320' }]}>
      <Text style={styles.ey}>
        Episode {p.number} · days {p.fromDay}–{p.toDay}
      </Text>
      <Text style={[styles.big, { fontSize: 120, lineHeight: 112, marginTop: 26, color: colors.ember }]}>{p.proofs}</Text>
      <Text style={[styles.ey, { color: colors.ink }]}>proofs</Text>
      <Text style={[styles.big, { fontSize: 40, lineHeight: 40, marginTop: 28 }]}>{p.title}</Text>
      <Text style={[styles.lineText, { marginTop: 10, color: colors.ink2, textTransform: 'none', letterSpacing: 0.4 }]}>{p.line}</Text>
      <Text style={[styles.ey, { marginTop: 14, color: colors.mint }]}>best streak {p.bestStreak} · {p.squadName}</Text>
      <Watermark squad={p.squadName} code={p.code} extra={`Episode ${p.number} of 3 · winter arc S01`} />
    </View>
  );
});
