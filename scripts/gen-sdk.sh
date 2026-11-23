#!/usr/bin/env bash
# Regenerate the SDK client from the program IDL. Commit program + generated files together.
set -euo pipefail
cd "$(dirname "$0")/.."
anchor build --arch v0
cp target/idl/scratchers.json packages/sdk/src/generated/scratchers.json
cp target/types/scratchers.ts packages/sdk/src/generated/scratchers.ts
echo "SDK client regenerated from $(git rev-parse --short HEAD)"
