# 0005. Claude verifies proofs; the app asks instead of rejecting

Date: 2026-09-05. Status: accepted.

## Context

A false reject on day three is a churn event. A false accept lets a fake proof move money in the ledger. Both rates must be measured, and the member-facing outcome must never accuse.

## Decision

- `packages/verifier` calls `claude-opus-5` with the two images, a cached rubric in the system prompt, the sport in the user turn, structured output through the zod schema in the domain package, adaptive thinking at low effort, and server-side refusal fallbacks.
- `decide` in the domain package turns the result into `verified` with a tier or `ask` with a reason. There is no `rejected` outcome for a member.
- Thresholds: confidence 0.75 to stamp, scene match 0.6, recapture suspicion at 0.7 triggers a retake ask.
- Every verification row stores model, rubric version, tokens, latency and whether the model refused.
- A rubric, threshold or model change ships only when the eval passes: false accepts under 5 percent, false rejects under 10 percent on the labeled set.

## Consequences

About one cent per proof on Opus 5 at roughly 1,500 image tokens. A cheaper model is a measured decision against the eval, never a default. The rubric must stay free of timestamps and ids so the cache holds.
