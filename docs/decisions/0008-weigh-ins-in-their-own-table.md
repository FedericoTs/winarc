# 0008. Weigh-ins live in their own owner-only table

Date: 2026-09-05. Status: accepted.

## Context

Rule 2 stakes the process and never the outcome, and the product rules make the weigh-in weekly, private and optional, with no absolute targets anywhere. The daily tick opens marks only for staked lines, so the weigh line never produces a due mark and a skipped weigh-in is never a miss. Proof images and proof rows are readable by squadmates by design, which is the wrong place for a body weight.

## Decision

Readings go into `weigh_ins` (migration `20260905000004`) with a single owner-only policy and no squad policy at all, on the table or on storage. There is no photo for the weigh-in in season one: it is unstaked, so nothing needs verifying. `log_weigh_in` runs as the caller, upserts today's reading and returns only the change since the first reading. The app shows the member their own numbers and that delta, and no squad surface shows either. The on-track badge the product rules allow as an opt-in is deferred until there is a way to express direction without a target.

## Consequences

The weigh-in cannot leak through any squad read path, including future ones on proofs. Health Connect and HealthKit readings and typed readings share one shape. An age gate is still needed before under-18s can sign up, because the rules forbid weight tracking for them.
