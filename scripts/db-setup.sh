#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env before running db:setup." >&2
  exit 1
fi

docker compose up -d --wait
npx prisma migrate deploy
npm run db:seed
