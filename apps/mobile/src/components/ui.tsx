import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme/tokens';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function Eyebrow({ children, color = colors.ink2 }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Display({ children, size = 40, style }: { children: ReactNode; size?: number; style?: TextStyle }) {
  return <Text style={[styles.display, { fontSize: size, lineHeight: size * 0.92 }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: TextStyle }) {
  return <Text style={[styles.body, muted && { color: colors.ink2 }, style]}>{children}</Text>;
}

export function Mono({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.mono, style]}>{children}</Text>;
}

export function Button({
  title,
  variant = 'primary',
  ...props
}: PressableProps & { title: string; variant?: 'primary' | 'ghost' }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        pressed && { transform: [{ scale: 0.985 }] },
        props.disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.ground }]}>{label}</Text>
    </Pressable>
  );
}

export function Tile({ value, label, color = colors.ink }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, paddingHorizontal: space(5), gap: space(3.5) },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  display: { fontFamily: fonts.display, color: colors.ink, textTransform: 'uppercase' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink2, letterSpacing: 0.5 },
  button: { backgroundColor: colors.ice, borderRadius: radius.button, paddingVertical: 16, alignItems: 'center' },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ground },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.ice, borderColor: colors.ice },
  chipText: { fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: 1, color: colors.ink },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.tile, padding: 12 },
  tileValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32 },
  tileLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.ink2, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, borderWidth: 1, borderColor: colors.line },
});
