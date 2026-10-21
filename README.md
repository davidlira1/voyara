# Voyara

Copy `.env.example` to `.env`, then start PostgreSQL, apply migrations, and seed the demo universe:

```text
npm run db:setup
```

Open SQL without installing `psql` on the host:

```text
docker exec -it voyara-postgres psql -U voyara -d voyara_db
```

Start the local HTTP API after the database is seeded. The API is an Express application. Set `VOYARA_DEV_ACCESS_TOKEN` in `.env` first. That token is only for local development, server-side tools, and automated tests. Nova also needs a server-side `GEMINI_API_KEY`. See [docs/http.md](docs/http.md) and [docs/nova.md](docs/nova.md).

```text
npm start
```
