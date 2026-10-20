import { spawn } from "node:child_process";
import "dotenv/config";
import { Client } from "pg";

const testDatabase = "voyara_test";
const maintenanceDatabase = "voyara_db";
const raw = process.env.DATABASE_URL;

if (raw === undefined || raw.trim() === "") {
  throw new Error("DATABASE_URL is required.");
}

const source = new URL(raw);
const sourceName = decodeURIComponent(source.pathname.replace(/^\/+/, ""));

if (sourceName !== maintenanceDatabase && sourceName !== testDatabase) {
  throw new Error(
    "HTTP integration tests must be prepared from voyara_db or voyara_test.",
  );
}

const admin = new URL(raw);
admin.pathname = `/${maintenanceDatabase}`;
const testUrl = new URL(raw);
testUrl.pathname = `/${testDatabase}`;
testUrl.search = "";
testUrl.hash = "";

const client = new Client({ connectionString: admin.toString() });
await client.connect();

let locked = false;
let exitCode = 1;

try {
  await client.query("SELECT pg_advisory_lock(44, 44044)");
  locked = true;

  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [testDatabase],
  );

  if (existing.rows.length === 0) {
    await client.query("CREATE DATABASE voyara_test");
  }

  exitCode = await run("npx", ["prisma", "migrate", "deploy"], testUrl.toString());

  if (exitCode === 0) {
    exitCode = await run(
      "npx",
      ["tsx", "--test", "--test-concurrency=1", "src/http/flow/reservation-flow.test.ts"],
      testUrl.toString(),
    );
  }
} finally {
  if (locked) {
    await client.query("SELECT pg_advisory_unlock(44, 44044)");
  }

  await client.end();
}

process.exit(exitCode);

function run(
  command: string,
  args: readonly string[],
  databaseUrl: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}
