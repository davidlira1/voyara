import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Clock } from "../../../application/clock.js";
import {
  CancellationNotAllowedError,
  InsufficientAvailabilityError,
  ReservationNotFoundError,
} from "../../../application/errors.js";
import { getFlightAvailability } from "../../../application/flights/flight-queries.js";
import { createConfirmedReservation } from "../../../application/reservations/create-confirmed-reservation.js";
import type { BookingRequest } from "../../../application/reservations/booking-request.js";
import { cancelReservation } from "../../../application/reservations/cancel-reservation.js";
import { getReservation } from "../../../application/reservations/get-reservation.js";
import { createCustomer } from "../../../domain/customers/customer.js";
import { createFlightAccommodation } from "../../../domain/flights/flight-accommodation.js";
import { createFlight } from "../../../domain/flights/flight.js";
import { FlightStatus } from "../../../domain/flights/flight-status.js";
import { createPassenger } from "../../../domain/passengers/passenger.js";
import { createMoney } from "../../../domain/shared/money.js";
import { createReservationPassenger } from "../../../domain/reservations/reservation-passenger.js";
import { createReservation } from "../../../domain/reservations/reservation.js";
import { ReservationStatus } from "../../../domain/reservations/reservation-status.js";
import { createBookingIdGenerator } from "../../identity/confirmation-code.js";
import { createRandomId } from "../../identity/random-id.js";
import { seedDatabase } from "../../seed/seed-database.js";
import { createPrismaClient, type PrismaClient } from "./client.js";
import { createPrismaCustomerRepository } from "./repositories/customer-repository.js";
import { createPrismaFlightQueryRepository } from "./repositories/flight-query-repository.js";
import { createPrismaFlightRepository } from "./repositories/flight-repository.js";
import { createPrismaPassengerRepository } from "./repositories/passenger-repository.js";
import { createPrismaReservationBooking } from "./repositories/reservation-booking.js";
import { createPrismaReservationCancellation } from "./repositories/reservation-cancellation.js";
import { createPrismaReservationQueryRepository } from "./repositories/reservation-query-repository.js";
import { createPrismaReservationRepository } from "./repositories/reservation-repository.js";
import { createPrismaTravelClassRepository } from "./repositories/travel-class-repository.js";
import { createPrismaVehicleRepository } from "./repositories/vehicle-repository.js";
import { createPrismaVoyageRepository } from "./repositories/voyage-repository.js";

const anchor = new Date("2026-10-07T00:00:00.000Z");
const clock: Clock = {
  now() {
    return new Date(anchor);
  },
};

describe("reservation retrieval and cancellation", { timeout: 180_000 }, () => {
  before(async () => {
    prismaRef = createPrismaClient();
    await seedDatabase({ anchor, prisma: prismaClient() });
  });

  after(async () => {
    await prismaClient().$disconnect();
  });

  it("reads confirmed, held, and cancelled seeded reservations", async () => {
    const dolly = await read("DLY-ARES");
    assert.equal(dolly.status, "CONFIRMED");
    assert.equal(dolly.customer.email, "dolly.hart@example.test");
    assert.equal(dolly.flight.flightNumber.length > 0, true);
    assert.equal(dolly.voyage.code, "ORB-07");
    assert.equal(dolly.voyage.name, "Ares");
    assert.equal(dolly.travelClass.code, "VOYAGER_PLUS");
    assert.deepEqual(
      dolly.passengers.map((passenger) => passenger.accommodationCode),
      ["P01", "P02", "P03"],
    );
    assert.equal(dolly.passengers[0]?.fare.amountMinor, 1_750_000);
    assert.equal(dolly.totalPrice.amountMinor, 5_250_000);
    assert.equal("id" in dolly, false);

    assert.equal((await read("JON-SOL")).status, "HELD");

    const cancelled = await read("MOR-CAN");
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.passengers[0]?.accommodationCode, "V01");
    assert.equal(cancelled.passengers[0]?.lastName, "Blake");

    const booked = await book(single(dolly.flight.flightNumber, "round.trip@example.test"));
    const stored = await read(booked.confirmationCode);
    assert.equal(stored.status, "CONFIRMED");
    assert.equal(stored.totalPrice.amountMinor, booked.totalPrice.amountMinor);
    assert.equal(
      stored.passengers[0]?.accommodationCode,
      booked.passengers[0]?.accommodationCode,
    );

    await assert.rejects(() => read("VY-MISSING"), ReservationNotFoundError);
  });

  it("cancels a booking, keeps its assignments, and lets a new booking take the seat", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-RELEASE",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-08-01T09:00:00.000Z"),
      returnAt: new Date("2099-08-01T13:00:00.000Z"),
      seats: ["V01"],
    });
    const original = await book(single(flightNumber, "release.original@example.test"));
    const cancelled = await cancel(original.confirmationCode);
    const stored = await read(original.confirmationCode);

    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.updatedAt.toISOString(), anchor.toISOString());
    assert.equal(stored.passengers.length, 1);
    assert.equal(stored.passengers[0]?.accommodationCode, "V01");
    assert.equal(stored.passengers[0]?.fare.amountMinor, original.passengers[0]?.fare.amountMinor);
    assert.equal(stored.totalPrice.amountMinor, original.totalPrice.amountMinor);

    const availability = await getFlightAvailability(
      createPrismaFlightQueryRepository(prismaClient()),
      flightNumber,
    );
    assert.deepEqual(
      availability.classes.find((travelClass) => travelClass.code === "VOYAGER")
        ?.availableAccommodationCodes,
      ["V01"],
    );

    const reused = await book(single(flightNumber, "release.next@example.test"));
    assert.equal(reused.passengers[0]?.accommodationCode, "V01");
    assert.equal((await read(original.confirmationCode)).status, "CANCELLED");
    assert.equal(
      (await read(original.confirmationCode)).passengers[0]?.accommodationCode,
      "V01",
    );
    await assertSingleOccupancy();
  });

  it("cancels a held reservation and leaves an already cancelled reservation unchanged", async () => {
    const held = await read("JON-SOL");
    const cancelled = await cancel("JON-SOL");
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(
      (await read("JON-SOL")).passengers[0]?.accommodationCode,
      held.passengers[0]?.accommodationCode,
    );

    const historical = await read("MOR-CAN");
    const again = await cancel("MOR-CAN");
    assert.equal(again.updatedAt.toISOString(), historical.updatedAt.toISOString());
    assert.equal(again.passengers[0]?.accommodationCode, "V01");
  });

  it("rejects completed reservations and reservations whose flight has departed", async () => {
    const completed = await fixtureReservation({
      flightNumber: "VY-COMPLETE",
      departureAt: new Date("2099-09-01T09:00:00.000Z"),
      returnAt: new Date("2099-09-01T13:00:00.000Z"),
      status: ReservationStatus.Completed,
      confirmationCode: "VYCOMPLETE",
    });
    await assert.rejects(
      () => cancel(completed),
      CancellationNotAllowedError,
    );
    assert.equal((await read(completed)).status, "COMPLETED");

    const departed = await fixtureReservation({
      flightNumber: "VY-ALREADY",
      departureAt: new Date("2026-01-01T09:00:00.000Z"),
      returnAt: new Date("2026-01-01T13:00:00.000Z"),
      status: ReservationStatus.Confirmed,
      confirmationCode: "VYALREADY",
    });
    const before = await read(departed);
    await assert.rejects(() => cancel(departed), CancellationNotAllowedError);
    assert.equal((await read(departed)).status, "CONFIRMED");
    assert.equal(
      (await read(departed)).updatedAt.toISOString(),
      before.updatedAt.toISOString(),
    );
  });

  it("serializes two cancellations on the reservation row lock", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-TWO-CANCEL",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-10-01T09:00:00.000Z"),
      returnAt: new Date("2099-10-01T13:00:00.000Z"),
      seats: ["V01"],
    });
    const original = await book(single(flightNumber, "two.cancel@example.test"));
    const firstInstant = new Date("2026-10-07T01:00:00.000Z");
    const secondInstant = new Date("2026-10-07T02:00:00.000Z");
    let clockCalls = 0;
    const sequenced: Clock = {
      now() {
        clockCalls += 1;
        return new Date(clockCalls === 1 ? firstInstant : secondInstant);
      },
    };
    const holder = await holdReservation(original.confirmationCode);
    const firstCancel = cancel(original.confirmationCode, sequenced);
    await waitForLockWaiters(1);
    const secondCancel = cancel(original.confirmationCode, sequenced);
    await waitForLockWaiters(2);
    holder.release();
    await holder.done;

    const [first, second] = await Promise.all([firstCancel, secondCancel]);
    const stored = await read(original.confirmationCode);
    assert.equal(first.status, "CANCELLED");
    assert.equal(second.status, "CANCELLED");
    assert.equal(first.updatedAt.toISOString(), firstInstant.toISOString());
    assert.equal(second.updatedAt.toISOString(), firstInstant.toISOString());
    assert.equal(stored.updatedAt.toISOString(), firstInstant.toISOString());
    assert.equal(stored.passengers[0]?.accommodationCode, "V01");
  });

  it("keeps a seat occupied until cancellation commits, then allows a new booking", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-RACE-CANCEL",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-11-01T09:00:00.000Z"),
      returnAt: new Date("2099-11-01T13:00:00.000Z"),
      seats: ["V01"],
    });
    const original = await book(single(flightNumber, "race.cancel@example.test"));
    const holder = await holdReservation(original.confirmationCode);
    const cancelling = cancel(original.confirmationCode);
    await waitForLockWaiters(1);

    await assert.rejects(
      () => book(single(flightNumber, "race.before@example.test")),
      (error: unknown) => {
        assert.equal(error instanceof InsufficientAvailabilityError, true);
        return true;
      },
    );

    holder.release();
    await holder.done;
    const cancelled = await cancelling;
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.passengers[0]?.accommodationCode, "V01");
    assert.equal(cancelled.totalPrice.amountMinor, original.totalPrice.amountMinor);

    const reused = await book(single(flightNumber, "race.after@example.test"));
    assert.equal(reused.passengers[0]?.accommodationCode, "V01");
    const historical = await read(original.confirmationCode);
    assert.equal(historical.status, "CANCELLED");
    assert.equal(historical.passengers[0]?.accommodationCode, "V01");
    assert.equal(historical.passengers[0]?.fare.amountMinor, original.passengers[0]?.fare.amountMinor);
    await assertSingleOccupancy();
  });

  it("reads a coherent reservation while cancellation is waiting to commit", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-READ-RACE",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-12-01T09:00:00.000Z"),
      returnAt: new Date("2099-12-01T13:00:00.000Z"),
      seats: ["V01", "V02"],
    });
    const original = await book({
      flightNumber,
      travelClassCode: "VOYAGER",
      customer: {
        firstName: "Nora",
        lastName: "Reader",
        email: "read.race@example.test",
        phone: "+1-555-0170",
      },
      passengers: [
        { firstName: "Nora", lastName: "Reader" },
        { firstName: "Ivo", lastName: "Reader" },
      ],
    });
    const before = await read(original.confirmationCode);
    const holder = await holdReservation(original.confirmationCode);
    const cancelling = cancel(original.confirmationCode);
    await waitForLockWaiters(1);

    const during = await read(original.confirmationCode);
    assert.equal(during.status, "CONFIRMED");
    assert.equal(during.updatedAt.toISOString(), before.updatedAt.toISOString());
    assert.deepEqual(
      during.passengers.map((passenger) => ({
        name: `${passenger.firstName} ${passenger.lastName}`,
        accommodationCode: passenger.accommodationCode,
        fare: passenger.fare.amountMinor,
      })),
      [
        { name: "Nora Reader", accommodationCode: "V01", fare: 120_000 },
        { name: "Ivo Reader", accommodationCode: "V02", fare: 120_000 },
      ],
    );
    assert.equal(during.totalPrice.amountMinor, 240_000);

    holder.release();
    await holder.done;
    const cancelled = await cancelling;
    const after = await read(original.confirmationCode);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(after.status, "CANCELLED");
    assert.equal(after.updatedAt.toISOString(), cancelled.updatedAt.toISOString());
    assert.deepEqual(
      after.passengers.map((passenger) => passenger.accommodationCode),
      ["V01", "V02"],
    );
    assert.equal(after.passengers[0]?.fare.amountMinor, 120_000);
    assert.equal(after.passengers[1]?.fare.amountMinor, 120_000);
    assert.equal(after.totalPrice.amountMinor, 240_000);
  });
});

function read(confirmationCode: string) {
  return getReservation(
    confirmationCode,
    createPrismaReservationQueryRepository(prismaClient()),
  );
}

function cancel(confirmationCode: string, activeClock: Clock = clock) {
  return cancelReservation(confirmationCode, {
    cancellations: createPrismaReservationCancellation(prismaClient()),
    clock: activeClock,
  });
}

function book(request: BookingRequest) {
  return createConfirmedReservation(request, {
    bookings: createPrismaReservationBooking(prismaClient()),
    ids: createBookingIdGenerator(),
    clock,
  });
}

let prismaRef: PrismaClient | undefined;

function prismaClient(): PrismaClient {
  if (prismaRef === undefined) {
    throw new Error("Prisma client is not ready.");
  }

  return prismaRef;
}

function single(flightNumber: string, email: string): BookingRequest {
  return {
    flightNumber,
    travelClassCode: "VOYAGER",
    customer: {
      firstName: "Ada",
      lastName: "Booker",
      email,
      phone: "+1-555-0177",
    },
    passengers: [{ firstName: "Ada", lastName: "Booker" }],
  };
}

async function fixtureFlight(input: {
  flightNumber: string;
  status: FlightStatus;
  departureAt: Date;
  returnAt: Date;
  seats: readonly string[];
}): Promise<string> {
  const prisma = prismaClient();
  const voyage = await createPrismaVoyageRepository(prisma).findByCode("ORB-01");
  const vehicle = await createPrismaVehicleRepository(prisma).findByCode(
    "Meridian-01",
  );
  const voyager = await createPrismaTravelClassRepository(prisma).findByCode(
    "VOYAGER",
  );

  if (voyage === null || vehicle === null || voyager === null) {
    throw new Error("Seed catalog is missing a fixture parent.");
  }

  const flight = createFlight({
    id: createRandomId(),
    flightNumber: input.flightNumber,
    voyageId: voyage.id,
    vehicleId: vehicle.id,
    departureAt: input.departureAt,
    returnAt: input.returnAt,
    status: input.status,
  });
  await createPrismaFlightRepository(prisma).save(flight);

  for (const code of input.seats) {
    await createPrismaFlightRepository(prisma).saveAccommodation(
      createFlightAccommodation({
        id: createRandomId(),
        flightId: flight.id,
        travelClassId: voyager.id,
        code,
      }),
    );
  }

  return input.flightNumber;
}

async function fixtureReservation(input: {
  flightNumber: string;
  departureAt: Date;
  returnAt: Date;
  status: ReservationStatus;
  confirmationCode: string;
}): Promise<string> {
  const flightNumber = await fixtureFlight({
    flightNumber: input.flightNumber,
    status: FlightStatus.Scheduled,
    departureAt: input.departureAt,
    returnAt: input.returnAt,
    seats: ["V01"],
  });
  const prisma = prismaClient();
  const flight = await prisma.flight.findUniqueOrThrow({
    where: { flightNumber },
    include: { accommodations: true },
  });
  const accommodation = flight.accommodations[0];

  if (accommodation === undefined) {
    throw new Error(`Missing seat on ${flightNumber}.`);
  }

  const timestamp = new Date("2026-09-01T00:00:00.000Z");
  const customer = createCustomer({
    id: createRandomId(),
    firstName: "Fixed",
    lastName: "Status",
    email: `${input.confirmationCode.toLowerCase()}@example.test`,
    phone: "+1-555-0188",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const passenger = createPassenger({
    id: createRandomId(),
    firstName: "Fixed",
    lastName: "Status",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const reservation = createReservation({
    id: createRandomId(),
    confirmationCode: input.confirmationCode,
    customerId: customer.id,
    flightId: flight.id,
    travelClassId: accommodation.travelClassId,
    status: input.status,
    totalPrice: createMoney(120_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await createPrismaCustomerRepository(prisma).save(customer);
  await createPrismaPassengerRepository(prisma).save(passenger);
  const reservations = createPrismaReservationRepository(prisma);
  await reservations.save(reservation);
  await reservations.savePassenger(
    createReservationPassenger({
      id: createRandomId(),
      reservationId: reservation.id,
      passengerId: passenger.id,
      flightAccommodationId: accommodation.id,
      fare: createMoney(120_000),
    }),
  );

  return input.confirmationCode;
}

async function holdReservation(confirmationCode: string): Promise<{
  release: () => void;
  done: Promise<unknown>;
}> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let holding!: () => void;
  const held = new Promise<void>((resolve) => {
    holding = resolve;
  });
  const done = prismaClient().$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT r.id
        FROM reservations r
        WHERE r.confirmation_code = ${confirmationCode}
        FOR UPDATE
      `;
      holding();
      await released;
    },
    { timeout: 20_000 },
  );
  await held;

  return { release, done };
}

async function waitForLockWaiters(minimum: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const rows = await prismaClient().$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND pid <> pg_backend_pid()
    `;

    if ((rows[0]?.count ?? 0) >= minimum) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for ${minimum} lock waiters.`);
}

async function assertSingleOccupancy(): Promise<void> {
  const conflicts = await prismaClient().$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT rp.flight_accommodation_id
      FROM reservation_passengers rp
      JOIN reservations r ON r.id = rp.reservation_id
      WHERE r.status::text IN ('HELD', 'CONFIRMED', 'COMPLETED')
      GROUP BY rp.flight_accommodation_id
      HAVING COUNT(*) > 1
    ) conflicts
  `;

  assert.equal(conflicts[0]?.count ?? 0, 0);
}
