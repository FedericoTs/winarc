# 0004. Stake and pot rule are squad terms, set by the founder

Date: 2026-09-05. Status: accepted.

## Context

The first prototype let each member choose a stake. That makes the pot unfair, the ledger unreadable, and adds a screen to every invitee's onboarding.

## Decision

`size`, `stake_cents`, `pot_rule` and `currency` live on `squads`. The founder sets them at creation. `join_squad` inherits them. Size is two to eight. A squad under three active members, or under its size for a pact of two, dissolves and the survivors are re-drafted.

## Consequences

Invitees reach the signature two screens sooner. Settlement math is one number per squad. Changing terms after creation is not supported in season one; a squad that wants different terms is a new squad before the lock date.
