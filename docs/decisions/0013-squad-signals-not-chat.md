# 0013. Squad signals, not chat

Date: 2026-09-08. Status: accepted.

## Context

The question was whether to add a chat and a "your friend just trained" notification before launch. Every squad already lives in a WhatsApp group, the concierge cohort runs in one by design, and a chat inside the app is a feed by another name, which rule 8 forbids. It would also bring the App Store's obligations for user text: blocking, reporting, moderation. The product's bet is that accountability needs evidence, stakes and witnesses, not conversation.

The social signal itself is real. Seeing a squadmate act changes behaviour at the moment it matters. But the app sends one push a day, at 20:00, only when a proof is missing, and that budget is what keeps notifications on.

## Decision

No chat. The group chat they have is the distribution channel, through the share poster and the proof card.

Three signals, all on the existing cron, token table and Expo sender, all rows first and pushes second so every rule is tested on plain Postgres (migration `20260908000000_squad_signals`):

1. The 20:00 nudge carries the squad's day: "3 of 4 proved. You are the one missing."
2. The first stamped mark of the day in a squad pings the squadmates whose marks are still open: "Marco went first. Runs at 06:48. Yours is still open." Once per squad per day, never to someone who has proved, dropped if they prove before it goes out, off per member with `profiles.squad_pings`.
3. Settlement reaches every member: the squad's week, then their own line of it.

Nothing is sent before 07:00 or after 22:59 in the recipient's time zone; held signals go at 07:00 and anything older than a day is dropped. A member therefore receives at most three pushes a day, the cap from the flows, and on most days one.

## Consequences

The social layer stays inside the day's loop and off the screen. Reactions, comments and any timeline stay out of season one; if members ask for them, the answer is the share card into the chat they already have. The `signals` table is the one place to add a fourth signal, and the quiet hours and the daily cap are enforced there, not in each sender.
