#!/usr/bin/env bash
# Copies the pure domain package and the verifier into the edge functions'
# shared folder, adding the explicit .ts extensions Deno requires on relative
# imports. Supabase only bundles files under supabase/functions, so the
# functions import these copies. Run after editing either package and before
# `supabase functions deploy`. Never edit the copies by hand.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=supabase/functions/_shared
rm -rf "$DEST/domain" "$DEST/verifier"
mkdir -p "$DEST/domain" "$DEST/verifier"
cp packages/domain/src/*.ts "$DEST/domain/"
cp packages/verifier/src/*.ts "$DEST/verifier/"
sed -i -E "s#(from '\./[A-Za-z0-9_-]+)'#\1.ts'#g" "$DEST"/domain/*.ts "$DEST"/verifier/*.ts
echo "synced packages/domain and packages/verifier into $DEST"
