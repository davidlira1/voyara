import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Clock } from "../application/clock.js";
import { MAX_NOVA_MESSAGE_LENGTH } from "../application/nova/chat-with-nova.js";
import { NovaUnavailableError } from "../application/errors.js";
import { NovaTimeoutError } from "../application/errors.js";
import type { LanguageModel } from "../application/ports/language-model.js";
import type { FlightSearchQuery } from "../application/flights/flight-search-criteria.js";
import type {
  FlightAvailabilityFacts,
  FlightClassFacts,
  FlightFacts,
  FlightQueryRepository,
} from "../application/ports/flight-query-repository.js";
import type { IdGenerator } from "../application/ports/id-generator.js";
import type {
  BookingFlight,
  BookingUnitOfWork,
  ReservationBooking,
} from "../application/ports/reservation-booking.js";
import type {
  ReservationCancellation,
  ReservationCancellationUnit,
} from "../application/ports/reservation-cancellation.js";
import type {
  ReservationFacts,
  ReservationQueryRepository,
} from "../application/ports/reservation-query-repository.js";
import type { VoyageQueryRepository } from "../application/ports/voyage-query-repository.js";
import { PersistenceError } from "../infrastructure/persistence/persistence-error.js";
import { loadHttpConfig } from "./config.js";
import { MAX_JSON_BODY_BYTES } from "./json.js";
import { closeServer, createHttpServer, listen, type HttpLog } from "./server.js";

const secretEmail = "ada-secret@example.test";
const completedEmail = "completed-secret@example.test";
const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe("HTTP server", () => {
  const devAccessToken = randomBytes(24).toString("hex");
  const clock: MutableClock = {
    instant: new Date("2026-10-07T00:00:00.000Z"),
    now() {
      return new Date(this.instant.getTime());
    },
  };
  const logs: LogEntry[] = [];
  const catalog = createCatalog();
  const ids = createSequentialIds();
  let server: Server;
  let baseUrl: URL;

  before(async () => {
    server = createHttpServer({
      ...catalog.ports(),
      ids,
      clock,
      devAccessToken,
      languageModel: idleLanguageModel,
      log: recordingLog(logs),
    });
    baseUrl = await listen(server);
  });

  after(async () => {
    await closeServer(server);
  });

  beforeEach(() => {
    clock.instant = new Date("2026-10-07T00:00:00.000Z");
    catalog.reset();
    ids.reset();
    logs.length = 0;
  });

  it("reads voyages, flights, and availability", async () => {
    const health = await send(baseUrl, "/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: "ok" });

    const voyages = await send(baseUrl, "/api/voyages");
    assert.equal(voyages.status, 200);
    assert.deepEqual(voyages.body, {
      voyages: [
        {
          code: "ORB-01",
          name: "Earthlight",
          description: "Low Earth orbit",
          durationMinutes: 240,
          baseFare: { amountMinor: 120_000, currency: "USD" },
        },
        {
          code: "ORB-02",
          name: "Blue Horizon",
          description: "High Earth orbit",
          durationMinutes: 480,
          baseFare: { amountMinor: 240_000, currency: "USD" },
        },
      ],
    });

    const voyage = await send(baseUrl, "/api/voyages/ORB-01");
    assert.equal(voyage.status, 200);
    assert.equal(voyage.body.code, "ORB-01");

    const flights = await send(
      baseUrl,
      "/api/flights?voyageCode=ORB-01&departureFrom=2099-01-01T00:00:00.000Z&departureTo=2099-12-31T00:00:00.000Z&travelClassCode=VOYAGER&passengerCount=1&limit=1",
    );
    assert.equal(flights.status, 200);
    assert.equal(flights.body.flights.length, 1);
    assert.equal(flights.body.flights[0].flightNumber, "VY-2401");
    assert.equal(flights.body.flights[0].departureAt, "2099-06-01T09:00:00.000Z");
    assert.equal(flights.body.flights[0].returnAt, "2099-06-01T13:00:00.000Z");
    assert.equal(flights.body.flights[0].status, "SCHEDULED");
    assert.deepEqual(flights.body.flights[0].classes[0].farePerPassenger, {
      amountMinor: 120_000,
      currency: "USD",
    });
    assert.deepEqual(catalog.lastSearch && {
      voyageCode: catalog.lastSearch.voyageCode,
      passengerCount: catalog.lastSearch.passengerCount,
      limit: catalog.lastSearch.limit,
      asOf: catalog.lastSearch.asOf.toISOString(),
      departureFrom: catalog.lastSearch.departureFrom?.toISOString(),
      departureTo: catalog.lastSearch.departureTo?.toISOString(),
    }, {
      voyageCode: "ORB-01",
      passengerCount: 1,
      limit: 1,
      asOf: "2026-10-07T00:00:00.000Z",
      departureFrom: "2099-01-01T00:00:00.000Z",
      departureTo: "2099-12-31T00:00:00.000Z",
    });

    const flight = await send(baseUrl, "/api/flights/VY-2401");
    assert.equal(flight.status, 200);
    assert.equal(flight.body.flightNumber, "VY-2401");
    assertNoInternalIds(flight.body);

    const availability = await send(baseUrl, "/api/flights/VY-2401/availability");
    assert.equal(availability.status, 200);
    assert.deepEqual(availability.body.classes[0], {
      code: "VOYAGER",
      name: "Voyager",
      farePerPassenger: { amountMinor: 120_000, currency: "USD" },
      availableCount: 2,
      totalCount: 2,
      availableAccommodationCodes: ["V01", "V02"],
    });
  });

  it("books, reads, and cancels a reservation", async () => {
    const booked = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: bookingBody("VY-2401", [
        { firstName: "Ada", lastName: "Lovelace" },
        { firstName: "Grace", lastName: "Hopper" },
      ]),
    });
    assert.equal(booked.status, 201);
    assert.equal(booked.headers.get("cache-control"), "no-store");
    assert.equal(booked.body.confirmationCode, "VYUNIT01");
    assert.equal(booked.body.status, "CONFIRMED");
    assert.equal(booked.body.departureAt, "2099-06-01T09:00:00.000Z");
    assert.deepEqual(
      booked.body.passengers.map((passenger: { accommodationCode: string; fare: { amountMinor: number } }) => ({
        accommodationCode: passenger.accommodationCode,
        fare: passenger.fare.amountMinor,
      })),
      [
        { accommodationCode: "V01", fare: 120_000 },
        { accommodationCode: "V02", fare: 120_000 },
      ],
    );
    assert.deepEqual(booked.body.totalPrice, {
      amountMinor: 240_000,
      currency: "USD",
    });
    assertNoInternalIds(booked.body);

    const during = await send(baseUrl, "/api/flights/VY-2401/availability");
    const duringVoyager = during.body.classes.find(
      (travelClass: { code: string }) => travelClass.code === "VOYAGER",
    );
    const duringPlus = during.body.classes.find(
      (travelClass: { code: string }) => travelClass.code === "VOYAGER_PLUS",
    );
    assert.equal(duringVoyager.availableCount, 0);
    assert.deepEqual(duringVoyager.availableAccommodationCodes, []);
    assert.deepEqual(duringPlus.availableAccommodationCodes, ["P01"]);

    const stored = await send(baseUrl, "/api/reservations/VYUNIT01", {
      token: devAccessToken,
    });
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get("cache-control"), "no-store");
    assert.equal(stored.body.customer.email, secretEmail);
    assert.equal(stored.body.status, "CONFIRMED");
    assert.equal(stored.body.createdAt, "2026-10-07T00:00:00.000Z");
    assertNoInternalIds(stored.body);

    clock.instant = new Date("2026-10-07T01:00:00.000Z");
    const cancelled = await send(baseUrl, "/api/reservations/VYUNIT01/cancel", {
      method: "POST",
      token: devAccessToken,
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "CANCELLED");
    assert.equal(cancelled.body.updatedAt, "2026-10-07T01:00:00.000Z");
    assert.equal(cancelled.body.passengers[0].fare.amountMinor, 120_000);

    clock.instant = new Date("2026-10-07T02:00:00.000Z");
    const repeated = await send(baseUrl, "/api/reservations/VYUNIT01/cancel", {
      method: "POST",
      token: devAccessToken,
      body: "{}",
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.status, "CANCELLED");
    assert.equal(repeated.body.updatedAt, "2026-10-07T01:00:00.000Z");

    const afterCancel = await send(baseUrl, "/api/flights/VY-2401/availability");
    assert.deepEqual(
      afterCancel.body.classes.find(
        (travelClass: { code: string }) => travelClass.code === "VOYAGER",
      ).availableAccommodationCodes,
      ["V01", "V02"],
    );
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes(secretEmail)), false);
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes(devAccessToken)), false);
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes("VYUNIT01")), false);
  });

  it("rejects unauthenticated reservation access", async () => {
    await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: bookingBody("VY-2401", [{ firstName: "Ada", lastName: "Lovelace" }]),
    });
    logs.length = 0;

    const missing = await send(baseUrl, "/api/reservations/VYDOESNOTEXIST");
    const hidden = await send(baseUrl, "/api/reservations/VYUNIT01", {
      token: `${devAccessToken.slice(0, -1)}x`,
    });
    const cancelled = await send(baseUrl, "/api/reservations/VYUNIT01/cancel", {
      method: "POST",
      body: JSON.stringify({
        email: secretEmail,
        confirmationCode: "VYUNIT01",
      }),
    });

    assert.equal(missing.status, 401);
    assert.equal(hidden.status, 401);
    assert.equal(cancelled.status, 401);
    assert.deepEqual(missing.body, hidden.body);
    assert.deepEqual(missing.body, {
      error: { code: "UNAUTHORIZED", message: "Access denied." },
    });
    assert.equal(cancelled.text.includes(secretEmail), false);
    assert.equal(hidden.text.includes("VYUNIT01"), false);
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes(secretEmail)), false);
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes(devAccessToken)), false);
    assert.equal(logs.some((entry) => JSON.stringify(entry).includes("VYUNIT01")), false);
  });

  it("maps application and request failures without sensitive details", async () => {
    const cases: Array<{
      path: string;
      method?: string;
      token?: string;
      body?: string;
      contentType?: string;
      status: number;
      code: string;
      message: string;
      absent: string;
    }> = [
      {
        path: "/api/voyages/SECRET-VOYAGE",
        status: 404,
        code: "VOYAGE_NOT_FOUND",
        message: "Voyage was not found.",
        absent: "SECRET-VOYAGE",
      },
      {
        path: "/api/flights/SECRET-FLIGHT",
        status: 404,
        code: "FLIGHT_NOT_FOUND",
        message: "Flight was not found.",
        absent: "SECRET-FLIGHT",
      },
      {
        path: "/api/flights/SECRET-FLIGHT/availability",
        status: 404,
        code: "FLIGHT_NOT_FOUND",
        message: "Flight was not found.",
        absent: "SECRET-FLIGHT",
      },
      {
        path: "/api/reservations/VYSECRET99",
        token: devAccessToken,
        status: 404,
        code: "RESERVATION_NOT_FOUND",
        message: "Reservation was not found.",
        absent: "VYSECRET99",
      },
      {
        path: "/api/flights?departureFrom=not-a-date-SECRET",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "SECRET",
      },
      {
        path: "/api/flights?departureFrom=2026-02-31T00:00:00.000Z",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "2026-03",
      },
      {
        path: "/api/flights?departureFrom=2026-11-05T00:00:00.000%2B99:00",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "+99:00",
      },
      {
        path: "/api/flights?passengerCount=0",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "positive",
      },
      {
        path: "/api/flights?passengerCount=03",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "03",
      },
      {
        path: "/api/flights?limit=101",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "100",
      },
      {
        path: "/api/flights?seat=V01",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "V01",
      },
      {
        path: "/api/flights?voyageCode=ORB-01&voyageCode=ORB-02",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "ORB-02",
      },
      {
        path: "/api/flights?departureFrom=2099-08-01T00:00:00.000Z&departureTo=2099-01-01T00:00:00.000Z",
        status: 400,
        code: "INVALID_SEARCH_CRITERIA",
        message: "Search criteria are invalid.",
        absent: "precede",
      },
      {
        path: "/api/missing",
        status: 404,
        code: "ROUTE_NOT_FOUND",
        message: "Route was not found.",
        absent: "missing",
      },
      {
        path: "/api/reservations/VYCOMPLETE/cancel",
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ reason: secretEmail }),
        status: 400,
        code: "INVALID_BODY",
        message: "Request body is invalid.",
        absent: secretEmail,
      },
    ];

    for (const expected of cases) {
      const response = await send(baseUrl, expected.path, {
        method: expected.method,
        token: expected.token,
        body: expected.body,
        contentType: expected.contentType,
      });
      assert.equal(response.status, expected.status, expected.path);
      assert.deepEqual(response.body, {
        error: { code: expected.code, message: expected.message },
      });
      assert.equal(response.text.includes(expected.absent), false, expected.path);
      assert.equal(response.text.includes("stack"), false);
    }

    const booking = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: JSON.stringify({
        flightNumber: " ",
        travelClassCode: "VOYAGER",
        customer: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: secretEmail,
          phone: "+1-555-0199",
        },
        passengers: [{ firstName: "Ada", lastName: "Lovelace" }],
        notes: secretEmail,
      }),
    });
    assert.equal(booking.status, 400);
    assert.deepEqual(booking.body, {
      error: {
        code: "INVALID_BOOKING",
        message: "Booking request is invalid.",
      },
    });
    assert.equal(booking.text.includes(secretEmail), false);

    const plain = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      contentType: "text/plain",
      body: secretEmail,
    });
    assert.equal(plain.status, 415);
    assert.equal(plain.text.includes(secretEmail), false);

    const malformed = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: `{"email":"${secretEmail}"`,
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body.error.code, "INVALID_JSON");
    assert.equal(malformed.text.includes(secretEmail), false);

    const oversized = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: `{"flightNumber":"${"x".repeat(MAX_JSON_BODY_BYTES)}"}`,
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(oversized.body.error.code, "PAYLOAD_TOO_LARGE");

    const unsupported = await send(baseUrl, "/api/voyages", { method: "POST" });
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get("allow"), "GET");
    assert.deepEqual(unsupported.body.error.code, "METHOD_NOT_ALLOWED");

    const unbookable = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: bookingBody("VY-PAST", [{ firstName: "Ada", lastName: "Lovelace" }]),
    });
    assert.equal(unbookable.status, 409);
    assert.deepEqual(unbookable.body.error, {
      code: "FLIGHT_NOT_BOOKABLE",
      message: "Flight is not bookable.",
    });
    assert.equal(unbookable.text.includes("VY-PAST"), false);

    const unsupportedClass = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: bookingBody(
        "VY-2401",
        [{ firstName: "Ada", lastName: "Lovelace" }],
        "CELESTIAL",
      ),
    });
    assert.equal(unsupportedClass.status, 409);
    assert.equal(unsupportedClass.body.error.code, "UNSUPPORTED_TRAVEL_CLASS");

    const full = await send(baseUrl, "/api/reservations", {
      method: "POST",
      token: devAccessToken,
      body: bookingBody("VY-2401", [
        { firstName: "Ada", lastName: "Lovelace" },
        { firstName: "Grace", lastName: "Hopper" },
        { firstName: "Katherine", lastName: "Johnson" },
      ]),
    });
    assert.equal(full.status, 409);
    assert.deepEqual(full.body.error, {
      code: "INSUFFICIENT_AVAILABILITY",
      message: "Not enough accommodations are available.",
    });

    const completed = await send(baseUrl, "/api/reservations/VYCOMPLETE/cancel", {
      method: "POST",
      token: devAccessToken,
    });
    assert.equal(completed.status, 409);
    assert.deepEqual(completed.body.error, {
      code: "CANCELLATION_NOT_ALLOWED",
      message: "Reservation cannot be cancelled.",
    });
    assert.equal(completed.text.includes("VYCOMPLETE"), false);
    assert.equal(completed.text.includes(completedEmail), false);
  });

  it("logs unexpected failures by name only", async () => {
    const failureLogs: LogEntry[] = [];
    const leaking = new PersistenceError(
      `SELECT ${secretEmail} FROM reservations WHERE confirmation_code = 'VYSECRET'`,
    );
    const failing = createHttpServer({
      ...catalog.ports(),
      ids,
      clock,
      devAccessToken,
      languageModel: idleLanguageModel,
      voyages: {
        async list() {
          throw leaking;
        },
        async findByCode() {
          return null;
        },
      },
      log: recordingLog(failureLogs),
    });
    const url = await listen(failing);

    try {
      const response = await send(url, "/api/voyages");
      assert.equal(response.status, 500);
      assert.deepEqual(response.body, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server failure.",
        },
      });
      assert.equal(response.text.includes(secretEmail), false);
      assert.equal(response.text.includes("SELECT"), false);
      assert.equal(response.text.includes("VYSECRET"), false);
      const recorded = JSON.stringify(failureLogs);
      assert.equal(recorded.includes(secretEmail), false);
      assert.equal(recorded.includes("SELECT"), false);
      assert.equal(recorded.includes("VYSECRET"), false);
      assert.equal(recorded.includes(devAccessToken), false);
      assert.deepEqual(
        failureLogs.find((entry) => entry.kind === "failure"),
        { kind: "failure", route: "/api/voyages", errorName: "PersistenceError" },
      );
    } finally {
      await closeServer(failing);
    }
  });
});

describe("HTTP configuration", () => {
  it("refuses production and a missing development token", () => {
    assert.throws(
      () =>
        loadHttpConfig({
          NODE_ENV: "production",
          VOYARA_DEV_ACCESS_TOKEN: "x".repeat(32),
        }),
      /refuses to start when NODE_ENV is production/,
    );
    assert.throws(
      () => loadHttpConfig({ VOYARA_DEV_ACCESS_TOKEN: "short" }),
      /VOYARA_DEV_ACCESS_TOKEN is required/,
    );
    assert.deepEqual(
      loadHttpConfig({ VOYARA_DEV_ACCESS_TOKEN: "x".repeat(16) }),
      {
        host: "127.0.0.1",
        port: 3000,
        devAccessToken: "x".repeat(16),
      },
    );
  });
});

describe("Nova chat", () => {
  const devAccessToken = randomBytes(24).toString("hex");
  const userMessage = "I want to see Mars.";
  const fakeKey = "gemini-test-key-should-not-leak";

  it("requires the development token and returns the fake reply", async () => {
    let calls = 0;
    const logs: LogEntry[] = [];
    const server = createHttpServer({
      ...createCatalog().ports(),
      ids: createSequentialIds(),
      clock: { now: () => new Date("2026-10-07T00:00:00.000Z") },
      devAccessToken,
      log: recordingLog(logs),
      languageModel: {
        async generate(input) {
          calls += 1;
          assert.equal(input.userMessage, userMessage);
          assert.equal(input.systemInstruction.includes(userMessage), false);
          assert.match(input.systemInstruction, /flight concierge/);
          return "Where would you like to go?";
        },
      },
    });
    const baseUrl = await listen(server);

    try {
      const denied = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage, token: fakeKey }),
      });
      assert.equal(denied.status, 401);
      assert.equal(calls, 0);
      assert.equal(denied.text.includes(userMessage), false);
      assert.equal(denied.text.includes(fakeKey), false);

      const accepted = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: `  ${userMessage}  ` }),
      });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.headers.get("cache-control"), "no-store");
      assert.deepEqual(accepted.body, {
        reply: "Where would you like to go?",
      });
      assert.equal(calls, 1);
      assert.equal(JSON.stringify(logs).includes(userMessage), false);
      assert.equal(JSON.stringify(logs).includes(fakeKey), false);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects an invalid message and hides upstream failures", async () => {
    const logs: LogEntry[] = [];
    const server = createHttpServer({
      ...createCatalog().ports(),
      ids: createSequentialIds(),
      clock: { now: () => new Date("2026-10-07T00:00:00.000Z") },
      devAccessToken,
      log: recordingLog(logs),
      languageModel: {
        async generate() {
          const error = new NovaUnavailableError();
          error.message = `upstream ${fakeKey} ${userMessage}`;
          throw error;
        },
      },
    });
    const baseUrl = await listen(server);

    try {
      const malformed = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: `{"message":"${userMessage}"`,
      });
      assert.equal(malformed.status, 400);
      assert.equal(malformed.body.error.code, "INVALID_JSON");
      assert.equal(malformed.text.includes(userMessage), false);

      const extra = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: userMessage, note: fakeKey }),
      });
      assert.equal(extra.status, 400);
      assert.deepEqual(extra.body, {
        error: { code: "INVALID_NOVA_MESSAGE", message: "Message is invalid." },
      });
      assert.equal(extra.text.includes(fakeKey), false);
      assert.equal(extra.text.includes(userMessage), false);

      const blank = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: "   " }),
      });
      assert.equal(blank.status, 400);
      assert.equal(blank.body.error.code, "INVALID_NOVA_MESSAGE");

      const oversized = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: "m".repeat(MAX_NOVA_MESSAGE_LENGTH + 1) }),
      });
      assert.equal(oversized.status, 400);
      assert.equal(oversized.body.error.code, "INVALID_NOVA_MESSAGE");

      const unavailable = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: userMessage }),
      });
      assert.equal(unavailable.status, 502);
      assert.deepEqual(unavailable.body, {
        error: { code: "NOVA_UNAVAILABLE", message: "Nova is unavailable." },
      });
      assert.equal(unavailable.text.includes(fakeKey), false);
      assert.equal(unavailable.text.includes(userMessage), false);
      const recorded = JSON.stringify(logs);
      assert.equal(recorded.includes(fakeKey), false);
      assert.equal(recorded.includes(userMessage), false);
      assert.equal(
        logs.some(
          (entry) =>
            entry.kind === "failure" && entry.errorName === "NovaUnavailableError",
        ),
        true,
      );
    } finally {
      await closeServer(server);
    }
  });

  it("maps a model timeout to the allowlisted timeout response", async () => {
    const server = createHttpServer({
      ...createCatalog().ports(),
      ids: createSequentialIds(),
      clock: { now: () => new Date("2026-10-07T00:00:00.000Z") },
      devAccessToken,
      log: recordingLog([]),
      languageModel: {
        async generate() {
          const error = new NovaTimeoutError();
          error.message = `timeout ${fakeKey} ${userMessage}`;
          throw error;
        },
      },
    });
    const baseUrl = await listen(server);

    try {
      const response = await send(baseUrl, "/api/nova/chat", {
        method: "POST",
        token: devAccessToken,
        body: JSON.stringify({ message: userMessage }),
      });
      assert.equal(response.status, 504);
      assert.deepEqual(response.body, {
        error: {
          code: "NOVA_TIMEOUT",
          message: "Nova took too long to respond.",
        },
      });
      assert.equal(response.text.includes(fakeKey), false);
      assert.equal(response.text.includes(userMessage), false);
    } finally {
      await closeServer(server);
    }
  });
});

const idleLanguageModel: LanguageModel = {
  async generate() {
    throw new Error("Nova was not part of this request.");
  },
};

type MutableClock = Clock & { instant: Date };

type LogEntry = {
  kind: "access" | "failure";
  method?: string;
  route: string;
  status?: number;
  errorName?: string;
};

type JsonResponse = {
  status: number;
  headers: Headers;
  body: any;
  text: string;
};

function recordingLog(entries: LogEntry[]): HttpLog {
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
  init: {
    method?: string;
    token?: string;
    body?: string;
    contentType?: string;
  } = {},
): Promise<JsonResponse> {
  const headers = new Headers();

  if (init.token !== undefined) {
    headers.set("authorization", `Bearer ${init.token}`);
  }

  if (init.body !== undefined) {
    headers.set("content-type", init.contentType ?? "application/json");
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
    body: text === "" ? null : JSON.parse(text),
  };
}

function bookingBody(
  flightNumber: string,
  passengers: readonly { firstName: string; lastName: string }[],
  travelClassCode = "VOYAGER",
): string {
  return JSON.stringify({
    flightNumber,
    travelClassCode,
    customer: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: secretEmail,
      phone: "+1-555-0199",
    },
    passengers,
  });
}

function assertNoInternalIds(value: unknown): void {
  assert.doesNotMatch(JSON.stringify(value), uuidPattern);
  walk(value);
}

function walk(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      assert.notEqual(key, "id");
      walk(nested);
    }
  }
}

function createSequentialIds(): IdGenerator & { reset(): void } {
  let nextId = 0;
  let nextCode = 0;

  return {
    reset() {
      nextId = 0;
      nextCode = 0;
    },
    newId() {
      nextId += 1;
      return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
    },
    newConfirmationCode() {
      nextCode += 1;
      return `VYUNIT${String(nextCode).padStart(2, "0")}`;
    },
  };
}

type MemorySeat = {
  id: string;
  flightId: string;
  travelClassId: string;
  code: string;
};

type MemoryClass = {
  id: string;
  code: string;
  name: string;
  numerator: number;
  denominator: number;
};

type MemoryFlight = {
  id: string;
  flightNumber: string;
  departureAt: Date;
  returnAt: Date;
  status: string;
  voyageCode: string;
  voyageName: string;
  baseFareAmountMinor: number;
  spacecraft: FlightFacts["spacecraft"];
};

function createCatalog(): {
  lastSearch: FlightSearchQuery | null;
  reset(): void;
  ports(): {
    voyages: VoyageQueryRepository;
    flights: FlightQueryRepository;
    bookings: ReservationBooking;
    reservations: ReservationQueryRepository;
    cancellations: ReservationCancellation;
  };
} {
  const voyages = [
    {
      code: "ORB-01",
      name: "Earthlight",
      description: "Low Earth orbit",
      durationMinutes: 240,
      baseFareAmountMinor: 120_000,
    },
    {
      code: "ORB-02",
      name: "Blue Horizon",
      description: "High Earth orbit",
      durationMinutes: 480,
      baseFareAmountMinor: 240_000,
    },
  ];
  const classes: MemoryClass[] = [
    {
      id: "travel-class-voyager",
      code: "VOYAGER",
      name: "Voyager",
      numerator: 1,
      denominator: 1,
    },
    {
      id: "travel-class-voyager-plus",
      code: "VOYAGER_PLUS",
      name: "Voyager+",
      numerator: 7,
      denominator: 5,
    },
  ];
  const spacecraft: FlightFacts["spacecraft"] = {
    code: "Meridian-01",
    name: "Meridian-01",
    familyCode: "MERIDIAN",
    familyName: "Meridian",
  };
  const flights: MemoryFlight[] = [
    flight("flight-2401", "VY-2401", "2099-06-01T09:00:00.000Z", "2099-06-01T13:00:00.000Z"),
    flight("flight-2402", "VY-2402", "2099-07-01T09:00:00.000Z", "2099-07-01T13:00:00.000Z"),
    flight("flight-past", "VY-PAST", "2020-01-01T09:00:00.000Z", "2020-01-01T13:00:00.000Z"),
  ];
  const seats: MemorySeat[] = [
    seat("seat-2401-v01", "flight-2401", "travel-class-voyager", "V01"),
    seat("seat-2401-v02", "flight-2401", "travel-class-voyager", "V02"),
    seat("seat-2401-p01", "flight-2401", "travel-class-voyager-plus", "P01"),
    seat("seat-2402-v01", "flight-2402", "travel-class-voyager", "V01"),
    seat("seat-2402-v02", "flight-2402", "travel-class-voyager", "V02"),
    seat("seat-past-v01", "flight-past", "travel-class-voyager", "V01"),
  ];
  let reservations: MemoryReservation[] = [];
  const catalog = {
    lastSearch: null as FlightSearchQuery | null,
    reset() {
      reservations = [completedReservation()];
      catalog.lastSearch = null;
    },
    ports() {
      return {
        voyages: voyagePort(),
        flights: flightPort(),
        bookings: bookingPort(),
        reservations: reservationPort(),
        cancellations: cancellationPort(),
      };
    },
  };

  function voyagePort(): VoyageQueryRepository {
    return {
      async list() {
        return voyages.map((voyage) => ({ ...voyage }));
      },
      async findByCode(code) {
        const voyage = voyages.find((candidate) => candidate.code === code);
        return voyage === undefined ? null : { ...voyage };
      },
    };
  }

  function flightPort(): FlightQueryRepository {
    return {
      async search(criteria) {
        catalog.lastSearch = criteria;
        return flights
          .filter((candidate) => matchesSearch(candidate, criteria))
          .sort(
            (left, right) =>
              left.departureAt.getTime() - right.departureAt.getTime() ||
              left.flightNumber.localeCompare(right.flightNumber),
          )
          .slice(0, criteria.limit)
          .map(toFlightFacts);
      },
      async findByFlightNumber(flightNumber) {
        const flightRecord = flights.find(
          (candidate) => candidate.flightNumber === flightNumber,
        );
        return flightRecord === undefined ? null : toFlightFacts(flightRecord);
      },
      async findAvailability(flightNumber) {
        const flightRecord = flights.find(
          (candidate) => candidate.flightNumber === flightNumber,
        );
        return flightRecord === undefined ? null : toAvailability(flightRecord);
      },
    };
  }

  function bookingPort(): ReservationBooking {
    return {
      async transact(work) {
        return work(bookingUnit());
      },
    };
  }

  function bookingUnit(): BookingUnitOfWork {
    return {
      async findFlight(flightNumber) {
        const flightRecord = flights.find(
          (candidate) => candidate.flightNumber === flightNumber,
        );
        return flightRecord === undefined ? null : toBookingFlight(flightRecord);
      },
      async lockAccommodations(input) {
        return availableSeats(input.flightId, input.travelClassId)
          .slice(0, input.count)
          .map((available) => ({ id: available.id, code: available.code }));
      },
      async persist(booking) {
        const flightRecord = flights.find(
          (candidate) => candidate.id === booking.reservation.flightId,
        );

        if (flightRecord === undefined) {
          throw new Error("Flight disappeared during booking.");
        }

        const travelClass = classes.find(
          (candidate) => candidate.id === booking.reservation.travelClassId,
        );

        if (travelClass === undefined) {
          throw new Error("Travel class disappeared during booking.");
        }

        const passengers = booking.passengers.map((passenger) => {
          const assignment = booking.assignments.find(
            (candidate) => candidate.passengerId === passenger.id,
          );
          const assignedSeat = seats.find(
            (candidate) => candidate.id === assignment?.flightAccommodationId,
          );

          if (assignment === undefined || assignedSeat === undefined) {
            throw new Error("Assignment disappeared during booking.");
          }

          return {
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            accommodationCode: assignedSeat.code,
            fareAmountMinor: assignment.fare.amountMinor,
          };
        });

        reservations.push({
          id: booking.reservation.id,
          flightId: flightRecord.id,
          travelClassId: travelClass.id,
          accommodationIds: booking.assignments.map(
            (assignment) => assignment.flightAccommodationId,
          ),
          facts: {
            confirmationCode: booking.reservation.confirmationCode,
            status: booking.reservation.status,
            customerFirstName: booking.customer.firstName,
            customerLastName: booking.customer.lastName,
            customerEmail: booking.customer.email,
            customerPhone: booking.customer.phone,
            flightNumber: flightRecord.flightNumber,
            departureAt: new Date(flightRecord.departureAt),
            returnAt: new Date(flightRecord.returnAt),
            flightStatus: flightRecord.status,
            voyageCode: flightRecord.voyageCode,
            voyageName: flightRecord.voyageName,
            travelClassCode: travelClass.code,
            travelClassName: travelClass.name,
            passengers,
            totalPriceAmountMinor: booking.reservation.totalPrice.amountMinor,
            createdAt: new Date(booking.reservation.createdAt),
            updatedAt: new Date(booking.reservation.updatedAt),
          },
        });

        return { confirmationCode: booking.reservation.confirmationCode };
      },
    };
  }

  function reservationPort(): ReservationQueryRepository {
    return {
      async findByConfirmationCode(confirmationCode) {
        return copyFacts(confirmationCode);
      },
    };
  }

  function cancellationPort(): ReservationCancellation {
    return {
      async transact(work) {
        return work(cancellationUnit());
      },
    };
  }

  function cancellationUnit(): ReservationCancellationUnit {
    return {
      async lockByConfirmationCode(confirmationCode) {
        const reservation = reservations.find(
          (candidate) => candidate.facts.confirmationCode === confirmationCode,
        );

        if (reservation === undefined) {
          return null;
        }

        const details = copyFacts(confirmationCode);

        return details === null ? null : { id: reservation.id, details };
      },
      async markCancelled(id, updatedAt) {
        const reservation = reservations.find((candidate) => candidate.id === id);

        if (reservation === undefined) {
          return;
        }

        reservation.facts = {
          ...reservation.facts,
          status: "CANCELLED",
          updatedAt: new Date(updatedAt),
        };
      },
    };
  }

  function matchesSearch(candidate: MemoryFlight, criteria: FlightSearchQuery): boolean {
    if (candidate.status !== "SCHEDULED" && candidate.status !== "DELAYED") {
      return false;
    }

    if (candidate.departureAt.getTime() <= criteria.asOf.getTime()) {
      return false;
    }

    if (
      criteria.voyageCode !== undefined &&
      candidate.voyageCode !== criteria.voyageCode
    ) {
      return false;
    }

    if (
      criteria.departureFrom !== undefined &&
      candidate.departureAt.getTime() < criteria.departureFrom.getTime()
    ) {
      return false;
    }

    if (
      criteria.departureTo !== undefined &&
      candidate.departureAt.getTime() > criteria.departureTo.getTime()
    ) {
      return false;
    }

    const classFacts = classSummaries(candidate);
    const relevant =
      criteria.travelClassCode === undefined
        ? classFacts
        : classFacts.filter((travelClass) => travelClass.code === criteria.travelClassCode);

    if (criteria.travelClassCode !== undefined && relevant.length === 0) {
      return false;
    }

    if (criteria.passengerCount !== undefined) {
      return relevant.some(
        (travelClass) => travelClass.availableCount >= criteria.passengerCount!,
      );
    }

    return true;
  }

  function toFlightFacts(candidate: MemoryFlight): FlightFacts {
    return {
      flightNumber: candidate.flightNumber,
      departureAt: new Date(candidate.departureAt),
      returnAt: new Date(candidate.returnAt),
      status: candidate.status,
      voyageCode: candidate.voyageCode,
      voyageName: candidate.voyageName,
      baseFareAmountMinor: candidate.baseFareAmountMinor,
      spacecraft: { ...candidate.spacecraft },
      classes: classSummaries(candidate),
    };
  }

  function toAvailability(candidate: MemoryFlight): FlightAvailabilityFacts {
    return {
      flightNumber: candidate.flightNumber,
      baseFareAmountMinor: candidate.baseFareAmountMinor,
      classes: classSummaries(candidate).map((travelClass) => ({
        ...travelClass,
        availableAccommodationCodes: availableSeats(
          candidate.id,
          classes.find((item) => item.code === travelClass.code)?.id ?? "",
        ).map((available) => available.code),
      })),
    };
  }

  function toBookingFlight(candidate: MemoryFlight): BookingFlight {
    return {
      id: candidate.id,
      flightNumber: candidate.flightNumber,
      departureAt: new Date(candidate.departureAt),
      returnAt: new Date(candidate.returnAt),
      status: candidate.status,
      voyageCode: candidate.voyageCode,
      voyageName: candidate.voyageName,
      baseFareAmountMinor: candidate.baseFareAmountMinor,
      classes: classes.filter((travelClass) =>
        seats.some(
          (available) =>
            available.flightId === candidate.id &&
            available.travelClassId === travelClass.id,
        ),
      ),
    };
  }

  function classSummaries(candidate: MemoryFlight): FlightClassFacts[] {
    return classes
      .map((travelClass) => {
        const classSeats = seats.filter(
          (available) =>
            available.flightId === candidate.id &&
            available.travelClassId === travelClass.id,
        );

        if (classSeats.length === 0) {
          return null;
        }

        return {
          code: travelClass.code,
          name: travelClass.name,
          numerator: travelClass.numerator,
          denominator: travelClass.denominator,
          totalCount: classSeats.length,
          availableCount: availableSeats(candidate.id, travelClass.id).length,
        };
      })
      .filter((travelClass) => travelClass !== null);
  }

  function availableSeats(flightId: string, travelClassId: string): MemorySeat[] {
    const occupied = new Set(
      reservations
        .filter((reservation) => occupying.has(reservation.facts.status))
        .flatMap((reservation) => reservation.accommodationIds),
    );

    return seats
      .filter(
        (available) =>
          available.flightId === flightId &&
          available.travelClassId === travelClassId &&
          !occupied.has(available.id),
      )
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  function copyFacts(confirmationCode: string): ReservationFacts | null {
    const reservation = reservations.find(
      (candidate) => candidate.facts.confirmationCode === confirmationCode,
    );

    if (reservation === undefined) {
      return null;
    }

    return {
      ...reservation.facts,
      departureAt: new Date(reservation.facts.departureAt),
      returnAt: new Date(reservation.facts.returnAt),
      createdAt: new Date(reservation.facts.createdAt),
      updatedAt: new Date(reservation.facts.updatedAt),
      passengers: [...reservation.facts.passengers].sort((left, right) =>
        left.accommodationCode.localeCompare(right.accommodationCode),
      ),
    };
  }

  function completedReservation(): MemoryReservation {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      flightId: "flight-2401",
      travelClassId: "travel-class-voyager",
      accommodationIds: [],
      facts: {
        confirmationCode: "VYCOMPLETE",
        status: "COMPLETED",
        customerFirstName: "Grace",
        customerLastName: "Hopper",
        customerEmail: completedEmail,
        customerPhone: "+1-555-0188",
        flightNumber: "VY-2401",
        departureAt: new Date("2099-06-01T09:00:00.000Z"),
        returnAt: new Date("2099-06-01T13:00:00.000Z"),
        flightStatus: "SCHEDULED",
        voyageCode: "ORB-01",
        voyageName: "Earthlight",
        travelClassCode: "VOYAGER",
        travelClassName: "Voyager",
        passengers: [
          {
            firstName: "Grace",
            lastName: "Hopper",
            accommodationCode: "V09",
            fareAmountMinor: 120_000,
          },
        ],
        totalPriceAmountMinor: 120_000,
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    };
  }

  function flight(
    id: string,
    flightNumber: string,
    departureAt: string,
    returnAt: string,
  ): MemoryFlight {
    return {
      id,
      flightNumber,
      departureAt: new Date(departureAt),
      returnAt: new Date(returnAt),
      status: "SCHEDULED",
      voyageCode: "ORB-01",
      voyageName: "Earthlight",
      baseFareAmountMinor: 120_000,
      spacecraft,
    };
  }

  catalog.reset();
  return catalog;
}

type MemoryReservation = {
  id: string;
  flightId: string;
  travelClassId: string;
  accommodationIds: readonly string[];
  facts: ReservationFacts;
};

const occupying = new Set(["HELD", "CONFIRMED", "COMPLETED"]);

function seat(
  id: string,
  flightId: string,
  travelClassId: string,
  code: string,
): MemorySeat {
  return { id, flightId, travelClassId, code };
}
