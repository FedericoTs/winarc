#!/usr/bin/env bash
# One-time setup on a fresh clone.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v pnpm >/dev/null || npm i -g pnpm@10
pnpm install
pnpm --filter @winarc/domain test
echo
echo "Next:"
echo "  1. cp .env.example apps/mobile/.env && fill in Supabase values"
echo "  2. supabase start   (needs Docker)  then  supabase db reset"
echo "  3. supabase secrets set ANTHROPIC_API_KEY=... VERIFY_MODEL=claude-opus-5"
echo "  4. pnpm mobile      (Expo dev client; run 'npx expo install --fix' if versions drift)"
