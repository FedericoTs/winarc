# 0006. Contract lines carry training days, not just a weekly number

Date: 2026-09-05. Status: accepted.

## Context

A daily deadline, a daily push, a board with misses on specific days and a Sunday ledger all need to know which days a line is due. "Four times a week" alone cannot say whether today is a miss.

## Decision

Each line has `days`, the weekdays it is due, defaulted from the frequency and editable until the lock date. Each due day gets a `day_marks` row: pending at midnight, verified or vouched on a stamp, missed when the day closes, rest when not due, sick when a sick day is used. The board and the ledger read marks, never proofs directly.

## Consequences

The member's week is explicit and screenshot-able. Moving a session to another day in the same week is a later feature. Days close at 23:59 local; Sundays and the finale day close at 21:00 because the ledger runs then.
