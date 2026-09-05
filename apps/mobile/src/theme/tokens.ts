/**
 * Design tokens. One dark world on the phone. Each color has one job:
 * ember is proof, gold is money, ice is structure and actions, rose is a
 * miss, mint is the squad. See CLAUDE.md.
 */
export const colors = {
  ground: '#0B0D12',
  surface: '#141821',
  surface2: '#1B2130',
  line: '#262E3C',
  ink: '#EAF2FA',
  ink2: '#8A97A8',
  ink3: '#5C6879',
  ice: '#9CD3FF',
  ember: '#FF7A1A',
  rose: '#FF4D6D',
  mint: '#7EE0B8',
  lilac: '#C4A7FF',
  gold: '#E9B54A',
} as const;

export const roles = {
  proof: colors.ember,
  money: colors.gold,
  action: colors.ice,
  missed: colors.rose,
  squad: colors.mint,
} as const;

/**
 * Target faces: Big Shoulders Display 900 for numerals and slates, Instrument
 * Sans for UI, IBM Plex Mono for the ledger and timecodes. Load them with
 * expo-font from @expo-google-fonts/big-shoulders-display,
 * @expo-google-fonts/instrument-sans and @expo-google-fonts/ibm-plex-mono,
 * then replace the fallbacks below.
 */
export const fonts = {
  display: undefined as string | undefined,
  body: undefined as string | undefined,
  mono: undefined as string | undefined,
};

export const radius = { card: 18, button: 14, chip: 12, tile: 14 } as const;

export const space = (n: number) => n * 4;
