# Voyara

Copy `.env.example` to `.env`, then start PostgreSQL, apply migrations, and seed the demo universe:

```text
npm run db:setup
```

Open SQL without installing `psql` on the host:

```text
docker exec -it voyara-postgres psql -U voyara -d voyara_db
```
