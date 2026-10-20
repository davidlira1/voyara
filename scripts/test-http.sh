#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env before running HTTP integration tests." >&2
  exit 1
fi

npx tsx scripts/prepare-http-test-database.ts

TEST_DATABASE_URL="$(
  node --env-file=.env --input-type=module -e '
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.pathname = "/voyara_test";
    url.search = "";
    url.hash = "";
    process.stdout.write(url.toString());
  '
)"

DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_DATABASE_URL" npx tsx --test --test-concurrency=1 src/http/flow/*.test.ts
