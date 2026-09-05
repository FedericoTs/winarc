# 0003. HealthKit and Health Connect verify; Strava is personal-only

Date: 2026-09-05. Status: accepted.

## Context

Strava's API agreement, in force since November 2024, allows a third-party app to show a member's Strava data only to that member and forbids using the data in AI systems. Garmin's direct developer onboarding was reported paused in 2026. Garmin Connect, Apple Watch, Withings, Oura and Whoop already write to Apple Health and Health Connect.

## Decision

- Verification evidence comes from HealthKit on iOS and Health Connect on Android. A matching workout inside the proof window turns a photo proof into Gold.
- Strava is an optional personal import, displayed only to its owner, never on the board, never a verification or model input.
- Terra is the paid aggregator for direct Garmin, Whoop and Oura webhooks when demand justifies it. Apply to Garmin's program as a company anyway and never depend on it.

## Consequences

The connector work is two native libraries and one interface, `apps/mobile/src/lib/health.ts`. The squad sees the app's own stamp, never third-party data.
