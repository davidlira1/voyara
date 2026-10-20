#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env before running HTTP integration tests." >&2
  exit 1
fi

npx tsx scripts/run-http-tests.ts
