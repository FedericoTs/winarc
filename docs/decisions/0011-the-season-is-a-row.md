# 0011. The season is a database row, not a constant in the binary

Date: 2026-09-07. Status: accepted.

## Context

`SEASON_ONE` was compiled into the app and the web page. The database already read its own `seasons` row for the daily tick, settlement and episodes, so the two could disagree, and there was no way to rehearse the deadline, miss, vouch or Sunday ledger on a device before 1 October without editing code. A slipped App Store review would have meant a new binary to move the start date.

## Decision

The `seasons` table is the source of truth. The app reads it once before the first paint through `loadSeason` and every screen renders `season()`; the web page reads it on the server through `getSeason`. Both pick the season with `pickSeason`, which mirrors `season_on` in SQL (the window from 30 days before the start through the finale, latest start first) and adds a fall-forward to the next season so the countdown works before any window opens. The database tests assert SQL and TypeScript agree on the same dates. `SEASON_ONE` remains as the offline fallback and the value the tests pin. Squads are created for the loaded season's id, never the SQL default alone.

A rehearsal is `supabase/rehearsal/season.sql` on a staging project: it rewrites the one row to a two-week arc starting tomorrow. `reset.sql` restores the real dates and clears the rows a rehearsal produced. Neither is ever run against production.

## Consequences

Moving the start date is an update. Staging and production run the same binary with different rows. A four-second timeout keeps the splash from hanging offline, at the cost of a stale season on a bad network; the fallback is the real season, so the cost is nil until a date actually moves.
