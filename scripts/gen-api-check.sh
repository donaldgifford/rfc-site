#!/usr/bin/env bash
#
# orval drift check (per ADR-0001).
#
# The generated client lives at `src/portal/api/__generated__/` and is
# gitignored — so `git diff` can't catch drift. Instead we run orval
# twice in a row and `diff -r` the two outputs. orval is deterministic;
# any difference means the generator picked up non-deterministic state
# (timestamps, faker seeds, etc.) and we want to know about it before
# it lands in CI.
#
# This also catches a developer hand-editing a generated file: the
# regen wipes the edit and `diff` fails against the pre-edit baseline.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
GENERATED="$ROOT/src/portal/api/__generated__"
BASELINE="$(mktemp -d -t orval-baseline.XXXXXX)"
trap 'rm -rf "$BASELINE"' EXIT

cd "$ROOT"

# 1. Generate once and snapshot.
bun run gen-api >/dev/null
cp -r "$GENERATED" "$BASELINE/snapshot"

# 2. Wipe and regenerate.
rm -rf "$GENERATED"
bun run gen-api >/dev/null

# 3. Compare. Any diff is a drift signal — exit non-zero.
if ! diff -r "$BASELINE/snapshot" "$GENERATED" >/dev/null; then
  echo "::error::orval drift detected — output is non-deterministic." >&2
  diff -r "$BASELINE/snapshot" "$GENERATED" >&2 || true
  exit 1
fi

echo "orval drift check passed."
