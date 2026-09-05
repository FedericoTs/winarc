# 0002. The pot is a ledger; no payments in season one

Date: 2026-09-05. Status: accepted.

## Context

Charging a personal card for a member's miss needs a legal entity, terms of service, dispute handling and chargeback exposure. Pooling money between members edges toward money transmission. None of that exists yet, and the launch is in weeks.

## Decision

Misses become ledger entries. Members settle between themselves outside the app, and the squad spends the pot by vote at the finale. The company holds no funds. Revenue is the Arc Pass through in-app purchase, where Apple handles tax, refunds and disputes.

## Consequences

Loss aversion comes from a public debt to friends, which is the mechanism that matters. Real settlement, charity and anti-charity beneficiaries are season-two features, gated on an entity, counsel and demand. The `pot_rule` column already allows them so no migration is needed later.
