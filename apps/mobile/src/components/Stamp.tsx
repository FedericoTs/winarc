import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Tier } from '@arc/domain';
import { colors, fonts } from '@/theme/tokens';

/**
 * The stamp slam. Ember for Gold and Silver, mint for a Bronze vouched by the
 * squad. Heavy haptic on impact, as designed.
 */
export function Stamp({ tier, subtitle }: { tier: Tier; subtitle: string }) {
  const scale = useSharedValue(3.2);
  const opacity = useSharedValue(0);
  const color = tier === 'BRONZE' ? colors.mint : colors.ember;
  const word = tier === 'BRONZE' ? 'Vouched' : 'Verified';

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 120 });
    scale.value = withSequence(withSpring(0.94, { damping: 14, stiffness: 260 }), withSpring(1, { damping: 12 }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: '-8deg' }, { scale: scale.value }], opacity: opacity.value }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.word, { borderColor: color }, style]}>
        <Text style={[styles.text, { color }]}>{word}</Text>
      </Animated.View>
      <Text style={styles.sub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center', gap: 12 },
  word: { borderWidth: 6, borderRadius: 14, paddingHorizontal: 18, paddingTop: 6, backgroundColor: 'rgba(11,13,18,0.35)' },
  text: { fontFamily: fonts.display, fontWeight: '900', fontSize: 72, letterSpacing: 4, lineHeight: 72, textTransform: 'uppercase' },
  sub: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 2.4, color: colors.ink, textTransform: 'uppercase' },
});
