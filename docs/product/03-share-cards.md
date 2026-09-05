# Share cards

Cards are the acquisition channel. They cost nothing and every one of them is an invite with a date on it.

## The screenshot test

A card ships only if it passes all five:

1. Reads at thumbnail size.
2. Carries exactly one number.
3. Signals the member's identity: sport, name or title.
4. Shows the squad: name, members or the join code.
5. Watermark with the app name, the season and the join code.

## The six cards

| Card | When | The number | Identity | Squad | Watermark |
|---|---|---|---|---|---|
| Contract poster | Day 0 | the stake | sports, signature | code, spots left, lock date | starts 01 Oct |
| Proof stamp | daily | Day N of 90 | sport, face, tier | N of M proved today | code, time |
| Board strip | weekly | squad streak | your row | every member | code, dates |
| Ledger | Sunday | the pot | your line | everyone ranked | code, week |
| Episode | days 30, 60, 90 | proofs | your title | streak | code, episode |
| Certificate | 31 Dec | 83 of 90 | your name, signature | named and dated | next arc opens 01 Jan, same code |

## Format

9:16 at 1080 by 1920. Rendered on device with react-native-view-shot from the same components as the screens. Never a screenshot of the UI: cards are composed, with no chrome.

## Instrumentation

Every share tap is an event named `card.shared` with the card type. Every join by code carries the code so a card's downstream signups can be counted. The Day 0 poster share rate is the first metric to watch: target 15 percent of signed contracts in week one.

## Later

Video episodes with Remotion when the episode card's share rate passes 20 percent. A first-proof versus last-proof card at the finale, places and faces by default, bodies only by opt-in.
