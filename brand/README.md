# The WinArc brand

## The mark: the Arc

A rising semicircle in ember with the W cut by its edge. The dome is the arc of the season, ninety days
that start on the first of October and bend towards the finale. The W is the name, and it only exists
inside the arc: all five terminals of the letter leave through the edge of the dome, so the letter is
made by the season rather than sitting on top of it. Read it as a sun coming up over the horizon, the
morning the proof is due, or as the W breaking through the top of its arc. Both are the product.

The construction is exact. Take a 1000-unit square. The dome is the semicircle of radius 380 centred at
(500, 660). The W is a stroke of width 108 with mitred joins through the five points (121.8, 150),
(365.7, 590), (500, 200), (634.3, 590) and (878.2, 150): the inner arms lean 19 degrees off vertical,
the outer arms 29. The stroke is clipped to the dome. `mark.svg` holds that result as two paths in a
tight 760 by 380 box, and the one-colour files hold the five pieces of dome the W leaves behind.
There are no masks, gradients or effects anywhere; every file is plain filled paths that any tool can
open and scale.

## Colours

| Name   | Hex       | Use                                           |
| ------ | --------- | --------------------------------------------- |
| Ember  | `#FF7A1A` | the dome, and `ARC` in the two-tone lockup    |
| Ink    | `#EAF2FA` | the W and `WIN` on dark surfaces              |
| Ground | `#0B0D12` | the app icon background, the W on light paper |

The mark is ember and ink on ground first. On white it is ember with the W in ground. Where one colour
is all there is (embroidery, engraving, a fax of a contract) use `mark-black.svg` or `mark-white.svg`:
the W becomes the void. Never put the dome in any colour but ember, ground or white.

## Files

| File                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `mark.svg`                | ember dome, ink W. For dark surfaces. The source of every other file       |
| `mark-on-light.svg`       | ember dome, ground W. For white and light surfaces                         |
| `mark-black.svg`          | one colour, ground. The W is the paper                                     |
| `mark-white.svg`          | one colour, white. For ember, black or photographic surfaces               |
| `wordmark.svg`            | WINARC set in Big Shoulders Display 900, converted to outlines             |
| `lockup.svg`              | mark plus wordmark, `WIN` in ink and `ARC` in ember, for dark surfaces     |
| `lockup-on-light.svg`     | the same lockup for white surfaces                                         |
| `lockup-black.svg`        | one-colour lockup, ground                                                  |
| `lockup-white.svg`        | one-colour lockup, white                                                   |
| `app-icon.svg`            | the App Store icon: ground square, mark on the 1024 grid. No corners: Apple cuts them |

The rasters the apps ship are rendered from these files and nothing else:

- `apps/mobile/assets/icon.png`: `app-icon.svg` at 1024, opaque.
- `apps/mobile/assets/adaptive-icon.png`: the mark at 580 px wide on a transparent 1024 canvas, inside
  Android's 66 percent safe circle, with the ground colour set in `app.json`.
- `apps/mobile/assets/splash-icon.png`: `lockup.svg` at 1200 px wide, transparent, shown 240 dp wide.
- `apps/mobile/assets/notification-icon.png`: `mark-white.svg` at 80 px on a 96 px canvas, the Android status-bar glyph.
- `apps/mobile/assets/brand/mark.png`: `mark.svg` at 168 by 84 for the front door, drawn at 32 by 16 dp.
- `apps/web/app/icon.svg`: the favicon, the app icon on a 64 grid with rounded corners.
- `apps/web/app/apple-icon.png`: the app icon at 180 for home-screen bookmarks.
- `apps/web/app/opengraph-image.png`: the share card, 1200 by 630, lockup and the one line.

`apps/web/components/mark.tsx` carries the two paths of `mark.svg` verbatim so the page draws the mark
inline. If the geometry ever changes, change it here first and regenerate everything from the SVGs.

## Rules

- Clear space: keep a margin of half the dome's height on every side. Nothing else lives in it.
- Minimum size: 20 px wide on screen, 8 mm in print for the mark; 90 px wide for the lockup. Below
  that use the mark alone.
- Dark first. The mark was drawn for the ground colour. On white use the `on-light` files.
- The wordmark is Big Shoulders Display 900 with two percent tracking, always capitals. On a page the
  live font is fine; on anything printed or embroidered use `wordmark.svg`, which is outlines.
- Do not: rotate the mark, stretch it, add a gradient, a stroke, a shadow or a glow, put it in a circle
  or a box other than the app icon, set the W in ember, redraw the W in a typeface, or lay it over a
  photograph without the white or ground one-colour version.
