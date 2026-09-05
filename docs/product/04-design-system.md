# Design system

Cinematic discipline. More film slate than grindset. One dark world on the phone; the web chrome follows the viewer's theme.

## Color roles

Each color has one job. Mixing jobs is the fastest way to make the board and the ledger unreadable.

| Token | Hex | Job |
|---|---|---|
| ground | `#0B0D12` | the screen |
| surface | `#141821` | cards and tiles |
| surface-2 | `#1B2130` | insets, steppers |
| line | `#262E3C` | borders |
| ink | `#EAF2FA` | text |
| ink-2 | `#8A97A8` | secondary text |
| ink-3 | `#5C6879` | tertiary text, never for anything that must be read |
| ember | `#FF7A1A` | proof and streaks only |
| gold | `#E9B54A` | money only: stakes, pot, owed amounts, vote bars |
| ice | `#9CD3FF` | structure and every primary action |
| rose | `#FF4D6D` | a miss |
| mint | `#7EE0B8` | the squad: MVP, matched, vouched |
| lilac | `#C4A7FF` | avatars only |

Status is never color alone. Every board cell carries a glyph. Every stamp carries a word.

## Type

- Big Shoulders Display, weight 900 for numerals and slates, 700 for secondary headings. Uppercase, tight leading.
- Instrument Sans for UI text.
- IBM Plex Mono for the ledger, timecodes, codes and eyebrows, with wide letter-spacing in uppercase.

Load them with expo-font from the expo-google-fonts packages and set the names in `apps/mobile/src/theme/tokens.ts`.

## Motion

Two moments only: the stamp slam, with a heavy haptic on impact, and counting numerals on the ledger. Everything else is still. Respect reduced motion.

## Vocabulary

Season, Arc, Day N of 90, Contract, Line, Squad, Terms, Code, Draft, Proof, Stamp, Tier, Board, Ledger, Round, Pot, Rescue, Sick day, Vouch, Appeal, Episode, Finale, Crew.

## Copy

Written from the member's side. Active voice. No em-dashes. One number per card. Never accuse. "We couldn't verify this one" is the only rejection sentence in the product.
