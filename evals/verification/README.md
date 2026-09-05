# Verification eval

The labeled proof set that gates every rubric change. Ship a change to the rubric, the thresholds or the model only when this passes.

## Gates

| Rate | Gate | Meaning |
|---|---|---|
| False accept | under 5 percent | A proof labeled `ask` came back `verified`. Stakes and trust depend on this one. |
| False reject | under 10 percent | A proof labeled `verified` came back `ask`. Every one is a member being asked to retake a real session. |

Both values live in `THRESHOLDS` in `packages/domain/src/verification.ts`.

## Building the set

Target 500 proofs before launch, of which at least 100 are adversarial. Every case is two images captured the way the app captures them: a rear photo of the place and a front photo of the person, taken within a second of each other.

Suggested mix:

- 60 percent genuine sessions across the sports people actually pick: gym, run, Hyrox, climb, swim, ride, padel, ski.
- 15 percent genuine but hard: dark gyms, home setups, treadmills, rain, masks, hats, phone at arm's length.
- 25 percent adversarial: a photo of a screen showing a gym, a printed picture, yesterday's photo re-shot, a stock image, a mirror selfie with no place, a person absent from the front image, an AI-generated gym.

Images live under `cases/` and are git-ignored. Only `cases.jsonl` is committed. Store the images in a private bucket and document where.

## Case format

One JSON object per line in `cases/cases.jsonl`:

```
{"id":"gym-001","rear":"gym/001-rear.jpg","front":"gym/001-front.jpg","sport":"GYM","health_matched":true,"expected":"verified","tags":["genuine","dark"]}
{"id":"adv-screen-004","rear":"adv/004-rear.jpg","front":"adv/004-front.jpg","sport":"RUN","expected":"ask","tags":["adversarial:screen"]}
```

`sport` is a catalog key or a custom name. `expected` is `verified` or `ask`. Tags are free text and show up in the report so you can see which adversarial class is leaking.

## Running

```
ANTHROPIC_API_KEY=... pnpm eval:verification
pnpm eval:verification -- --limit 20 --concurrency 4 --model claude-opus-5
```

The report is written to `out/report.json`. Compare reports before and after a change, not just the pass line.

## Cost

About 1,500 image tokens per proof. On `claude-opus-5` a 500-case run is on the order of five dollars. Run the full set before a rubric change and a 50-case smoke set in CI when a key is configured.
