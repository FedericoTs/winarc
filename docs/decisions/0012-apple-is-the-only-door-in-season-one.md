# 0012. Sign in with Apple is the only door in season one

Date: 2026-09-07. Status: accepted.

## Context

Supabase's built-in email sender is a development service: rate-limited, unable to deliver reliably beyond the project owner, and its templates cannot be edited without custom SMTP. Custom SMTP needs a verified sending domain, and the domain is not bought yet. The app's email path asks for a six-digit code that the stock template does not contain.

## Decision

On iPhone the app shows Sign in with Apple and nothing else, behind `features.emailSignIn` in `apps/mobile/src/config.ts`. The email code path stays in the repository and switches back on the day custom SMTP exists. Nothing else in the product sends email: nudges go through Expo push, the ledger is a screen, the join loop is a code.

## Consequences

Every iOS member has an Apple ID, so nobody is locked out. A second test account on one phone is not possible; the vouch test uses a second person's device, which TestFlight provides anyway. Android at day 30 needs Google sign-in or the email path with SMTP.
