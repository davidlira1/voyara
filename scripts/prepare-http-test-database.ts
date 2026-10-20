import "dotenv/config";
import { Client } from "pg";

const testDatabase = "voyara_test";
const raw = process.env.DATABASE_URL;

if (raw === undefined || raw.trim() === "") {
  throw new Error("DATABASE_URL is required.");
}

const source = new URL(raw);
const sourceName = decodeURIComponent(source.pathname.replace(/^\/+/, ""));

if (sourceName !== "voyara_db" && sourceName !== testDatabase) {
  throw new Error(
    "HTTP integration tests must be prepared from voyara_db or voyara_test.",
  );
}

const admin = new URL(raw);
admin.pathname = "/voyara_db";

const client = new Client({ connectionString: admin.toString() });
await client.connect();

try {
  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [testDatabase],
  );

  if (existing.rows.length === 0) {
    await client.query("CREATE DATABASE voyara_test");
  }
} finally {
  await client.end();
}
