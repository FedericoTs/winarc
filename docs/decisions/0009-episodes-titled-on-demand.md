# 0009. Episodes are titled on demand from the member's device

Date: 2026-09-05. Status: accepted.

## Context

Days 30, 60 and 90 render an episode from the member's own marks, titled by the model in training-arc language. A scheduled job would need pg_net calling an HTTP function with a shared secret, the setup ADR 0007 removed, and would title episodes for members who never open the app.

## Decision

`episode_stats` is a SQL function that mirrors `episodeStats` in the domain package; the database tests assert the two agree on one fixture. The `title-episode` edge function is called by the device the first time the Arc tab opens after the day arrives. It is idempotent, refuses before the day, feeds the model counts and sport names only, never images, names or weight, and falls back to a deterministic title from `fallbackTitle` when the model refuses, fails or returns something the schema rejects. The row is written by the service role, so members and squadmates can read episodes but only the function writes them.

## Consequences

No cron, no secret, no wasted model calls. A member who opens the app on day 45 gets episode 1 then. The card renders from stored stats, so a title never changes once shown. Video episodes, when the card's share rate earns them, can reuse the same stats and title.
