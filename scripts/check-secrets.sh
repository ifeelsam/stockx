#!/usr/bin/env bash
# Pre-commit: block key/env files and secret-looking content in staged changes.
set -euo pipefail
bad=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(^|/)(\.env($|\.)|id\.json$)|-keypair\.json$|\.keystore$|\.jks$|target/deploy/.*\.json$' | grep -v '\.env\.example$' || true)
if [ -n "$bad" ]; then echo "BLOCKED: secret-like paths staged:"; echo "$bad"; exit 1; fi
if git diff --cached -U0 | grep -E '^\+' | grep -qE 'PRIVY_APP_SECRET\s*=\s*[^[:space:]]+|BEGIN [A-Z ]*PRIVATE KEY|\[([0-9]{1,3},){63}[0-9]{1,3}\]|[1-9A-HJ-NP-Za-km-z]{86,90}'; then
  echo "BLOCKED: staged diff looks like it contains a secret (key bytes / base58 keypair / PRIVY_APP_SECRET)"; exit 1
fi
if command -v gitleaks >/dev/null; then gitleaks protect --staged --no-banner -v || exit 1; fi
