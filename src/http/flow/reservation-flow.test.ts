import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type { Clock } from "../../application/clock.js";
import { seedDatabase } from "../../infrastructure/seed/seed-database.js";
import {
  createPrismaClient,
  type PrismaClient,
} from "../../infrastructure/persistence/prisma/client.js";
import { composeHttpServer } from "../compose.js";
import { closeServer, listen, type HttpLog } from "../server.js";

const anchor = new Date("2026-10-07T00:00:00.000Z");
const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe("HTTP reservation flow", { timeout: 120_000 }, () => {
  const devAccessToken = randomBytes(24).toString("hex");
  const logs: Array<Record<string, string | number>> = [];
  const clock: Clock & { instant: Date } = {
    instant: new Date(anchor),
    now() {
      return new Date(this.instant.getTime());
    },
  };
  let prisma: PrismaClient | undefined;
  let server: Server | undefined;
  let baseUrl: URL;

  before(async () => {
    assertIsolatedTestDatabase();
    prisma = createPrismaClient();
    await seedDatabase({ anchor, prisma });
    server = composeHttpServer({
      prisma,
      devAccessToken,
      clock,
      log: recordingLog(logs),
    });
    baseUrl = await listen(server);
  });

  after(async () => {
    if (server !== undefined) {
      await closeServer(server);
    }

    if (prisma !== undefined) {
      await prisma.$disconnect();
    }
  });

  it("searches, books, reads, and cancels against PostgreSQL", async () => {
    const voyages = await send(baseUrl, "/api/voyages");
    assert.equal(voyages.status, 200);
    assert.equal(voyages.json.voyages.length, 10);
    assert.equal(
      voyages.json.voyages.some(
        (voyage: { code: string }) => voyage.code === "ORB-01",
      ),
      true,
    );

    const earthlight = await send(baseUrl, "/api/voyages/ORB-01");
    assert.equal(earthlight.status, 200);
    assert.equal(earthlight.json.name, "Earthlight");
    assert.deepEqual(earthlight.json.baseFare, {
      amountMinor: 120_000,
      currency: "USD",
    });

    const search = await send(
      baseUrl,
      "/api/flights?voyageCode=ORB-01&travelClassCode=VOYAGER&passengerCount=1&limit=1",
    );
    assert.equal(search.status, 200);
    assert.equal(search.json.flights.length, 1);
    const flight = search.json.flights[0];
    assert.equal(flight.departureAt, "2026-10-08T09:00:00.000Z");
    assert.equal(flight.status, "SCHEDULED");
    const searchVoyager = flight.classes.find(
      (travelClass: { code: string }) => travelClass.code === "VOYAGER",
    );
    assert.equal(searchVoyager.farePerPassenger.amountMinor, 120_000);
    assert.doesNotMatch(search.text, uuidPattern);

    const flightNumber = flight.flightNumber as string;
    const beforeBooking = await send(
      baseUrl,
      `/api/flights/${flightNumber}/availability`,
    );
    const voyager = classByCode(beforeBooking.json, "VOYAGER");
    const openSeat = voyager.availableAccommodationCodes[0] as string;
    const openCount = voyager.availableCount as number;
    assert.equal(openSeat, "V02");
    assert.ok(openCount > 0);

    const denied = await send(baseUrl, "/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        flightNumber,
        travelClassCode: "VOYAGER",
        customer: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada.flow@example.test",
          phone: "+1-555-0199",
        },
        passengers: [{ firstName: "Ada", lastName: "Lovelace" }],
      }),
    });
    assert.equal(denied.status, 401);
    assert.equal(denied.text.includes("ada.flow@example.test"), false);

    const booked = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: JSON.stringify({
        flightNumber,
        travelClassCode: "VOYAGER",
        customer: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada.flow@example.test",
          phone: "+1-555-0199",
        },
        passengers: [{ firstName: "Ada", lastName: "Lovelace" }],
      }),
    });
    assert.equal(booked.status, 201);
    assert.equal(booked.json.status, "CONFIRMED");
    assert.equal(booked.json.passengers[0].accommodationCode, openSeat);
    assert.equal(booked.json.passengers[0].fare.amountMinor, 120_000);
    assert.deepEqual(booked.json.totalPrice, {
      amountMinor: 120_000,
      currency: "USD",
    });
    assert.doesNotMatch(booked.text, uuidPattern);
    const confirmationCode = booked.json.confirmationCode as string;

    const hidden = await send(
      baseUrl,
      `/api/reservations/${confirmationCode}`,
    );
    const missing = await send(baseUrl, "/api/reservations/VYDOESNOTEXIST");
    assert.equal(hidden.status, 401);
    assert.equal(missing.status, 401);
    assert.equal(hidden.text, missing.text);
    assert.equal(hidden.text.includes(confirmationCode), false);
    assert.equal(hidden.text.includes("ada.flow@example.test"), false);

    const stored = await send(
      baseUrl,
      `/api/reservations/${confirmationCode}`,
      { token: devAccessToken },
    );
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get("cache-control"), "no-store");
    assert.equal(stored.json.status, "CONFIRMED");
    assert.equal(stored.json.customer.email, "ada.flow@example.test");
    assert.equal(stored.json.createdAt, anchor.toISOString());
    assert.doesNotMatch(stored.text, uuidPattern);

    const occupied = await send(
      baseUrl,
      `/api/flights/${flightNumber}/availability`,
    );
    const occupiedVoyager = classByCode(occupied.json, "VOYAGER");
    assert.equal(occupiedVoyager.availableCount, openCount - 1);
    assert.equal(
      occupiedVoyager.availableAccommodationCodes.includes(openSeat),
      false,
    );

    clock.instant = new Date("2026-10-07T01:00:00.000Z");
    const cancelled = await send(
      baseUrl,
      `/api/reservations/${confirmationCode}/cancel`,
      { method: "POST", token: devAccessToken },
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.status, "CANCELLED");
    assert.equal(cancelled.json.updatedAt, "2026-10-07T01:00:00.000Z");
    assert.equal(cancelled.json.passengers[0].fare.amountMinor, 120_000);

    clock.instant = new Date("2026-10-07T02:00:00.000Z");
    const repeated = await send(
      baseUrl,
      `/api/reservations/${confirmationCode}/cancel`,
      { method: "POST", token: devAccessToken, body: "{}" },
    );
    assert.equal(repeated.status, 200);
    assert.equal(repeated.json.status, "CANCELLED");
    assert.equal(repeated.json.updatedAt, "2026-10-07T01:00:00.000Z");

    const released = await send(
      baseUrl,
      `/api/flights/${flightNumber}/availability`,
    );
    const releasedVoyager = classByCode(released.json, "VOYAGER");
    assert.equal(releasedVoyager.availableCount, openCount);
    assert.equal(
      releasedVoyager.availableAccommodationCodes.includes(openSeat),
      true,
    );

    const recorded = JSON.stringify(logs);
    assert.equal(recorded.includes(devAccessToken), false);
    assert.equal(recorded.includes(confirmationCode), false);
    assert.equal(recorded.includes("ada.flow@example.test"), false);
    assert.equal(recorded.includes("SELECT"), false);
  });
});

function assertIsolatedTestDatabase(): void {
  const raw = process.env.DATABASE_URL;

  if (raw === undefined || raw.trim() === "") {
    throw new Error(
      "HTTP integration tests require DATABASE_URL to name voyara_test.",
    );
  }

  const database = decodeURIComponent(
    new URL(raw).pathname.replace(/^\/+/, ""),
  );

  if (database !== "voyara_test") {
    throw new Error(
      `HTTP integration tests refuse to use database "${database}". Use voyara_test.`,
    );
  }
}

function classByCode(
  body: { classes: Array<Record<string, unknown>> },
  code: string,
): { availableCount: number; availableAccommodationCodes: string[] } {
  const travelClass = body.classes.find((candidate) => candidate.code === code);

  if (travelClass === undefined) {
    throw new Error(`Missing travel class ${code}.`);
  }

  return travelClass as {
    availableCount: number;
    availableAccommodationCodes: string[];
  };
}

function recordingLog(
  entries: Array<Record<string, string | number>>,
): HttpLog {
  return {
    access(entry) {
      entries.push({ kind: "access", ...entry });
    },
    failure(entry) {
      entries.push({ kind: "failure", ...entry });
    },
  };
}

async function send(
  baseUrl: URL,
  path: string,
  init: { method?: string; token?: string; body?: string } = {},
): Promise<{
  status: number;
  headers: Headers;
  text: string;
  json: any;
}> {
  const headers = new Headers();

  if (init.token !== undefined) {
    headers.set("authorization", `Bearer ${init.token}`);
  }

  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: init.method ?? "GET",
    headers,
    body: init.body,
  });
  const text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    text,
    json: text === "" ? null : JSON.parse(text),
  };
}
