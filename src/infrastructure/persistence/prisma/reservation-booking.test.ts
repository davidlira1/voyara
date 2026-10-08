import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Clock } from "../../../application/clock.js";
import {
  FlightNotBookableError,
  FlightNotFoundError,
  InsufficientAvailabilityError,
  UnsupportedTravelClassError,
} from "../../../application/errors.js";
import { createConfirmedReservation } from "../../../application/reservations/create-confirmed-reservation.js";
import type { BookingRequest } from "../../../application/reservations/booking-request.js";
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
import { createPrismaFlightRepository } from "./repositories/flight-repository.js";
import { createPrismaPassengerRepository } from "./repositories/passenger-repository.js";
import {
  createPrismaReservationBooking,
  isConfirmationCodeConflict,
} from "./repositories/reservation-booking.js";
import { createPrismaReservationRepository } from "./repositories/reservation-repository.js";
import { createPrismaTravelClassRepository } from "./repositories/travel-class-repository.js";
import { createPrismaVehicleRepository } from "./repositories/vehicle-repository.js";
import { createPrismaVoyageRepository } from "./repositories/voyage-repository.js";

describe("isConfirmationCodeConflict", () => {
  it("matches only the reservation confirmation code constraint", () => {
    assert.equal(
      isConfirmationCodeConflict({
        code: "P2002",
        meta: { modelName: "Reservation", target: ["confirmationCode"] },
      }),
      true,
    );
    assert.equal(
      isConfirmationCodeConflict({
        code: "P2002",
        meta: { target: "reservations_confirmation_code_key" },
      }),
      true,
    );
  });

  it("does not match an unrelated unique violation", () => {
    assert.equal(
      isConfirmationCodeConflict({
        code: "P2002",
        meta: { modelName: "Flight", target: ["flightNumber"] },
      }),
      false,
    );
    assert.equal(
      isConfirmationCodeConflict({
        code: "P2002",
        meta: { target: ["code"] },
      }),
      false,
    );
    assert.equal(isConfirmationCodeConflict({ code: "P2003" }), false);
  });
});

const anchor = new Date("2026-10-07T00:00:00.000Z");
const clock: Clock = {
  now() {
    return new Date(anchor);
  },
};

describe("createConfirmedReservation", { timeout: 180_000 }, () => {
  before(async () => {
    prismaRef = createPrismaClient();
    await seedDatabase({ anchor, prisma: prismaClient() });
  });

  after(async () => {
    await prismaClient().$disconnect();
  });

  it("books the lowest open seat and prices it from the voyage", async () => {
    const earthlight = await firstFlight("ORB-01");
    const confirmation = await book({
      flightNumber: earthlight.flightNumber,
      travelClassCode: "VOYAGER",
      customer: customer("Ada", "Booker", "ada.booker@example.test"),
      passengers: [{ firstName: "Ada", lastName: "Booker" }],
    });

    assert.equal(confirmation.status, "CONFIRMED");
    assert.equal(confirmation.voyage.code, "ORB-01");
    assert.equal(confirmation.travelClass.code, "VOYAGER");
    assert.equal(confirmation.passengers.length, 1);
    assert.equal(confirmation.passengers[0]?.accommodationCode, "V02");
    assert.equal(confirmation.passengers[0]?.fare.amountMinor, 120_000);
    assert.equal(confirmation.totalPrice.amountMinor, 120_000);
    assert.equal("id" in confirmation, false);
  });

  it("rejects an unsupported class, a missing flight, and a flight that cannot be booked", async () => {
    const earthlight = await firstFlight("ORB-01");

    await assert.rejects(
      () =>
        book({
          flightNumber: earthlight.flightNumber,
          travelClassCode: "CELESTIAL",
          customer: customer("Cee", "Class", "cee.class@example.test"),
          passengers: [{ firstName: "Cee", lastName: "Class" }],
        }),
      UnsupportedTravelClassError,
    );
    await assert.rejects(
      () =>
        book({
          flightNumber: "VY-NONE",
          travelClassCode: "VOYAGER",
          customer: customer("No", "Flight", "no.flight@example.test"),
          passengers: [{ firstName: "No", lastName: "Flight" }],
        }),
      FlightNotFoundError,
    );

    const cancelled = await fixtureFlight({
      flightNumber: "VY-CANCELLED",
      status: FlightStatus.Cancelled,
      departureAt: new Date("2099-04-01T09:00:00.000Z"),
      returnAt: new Date("2099-04-01T13:00:00.000Z"),
      seats: ["V01"],
    });
    await assert.rejects(
      () =>
        book({
          flightNumber: cancelled,
          travelClassCode: "VOYAGER",
          customer: customer("Can", "Cel", "can.cel@example.test"),
          passengers: [{ firstName: "Can", lastName: "Cel" }],
        }),
      FlightNotBookableError,
    );

    const departed = await fixtureFlight({
      flightNumber: "VY-DEPARTED",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2026-01-01T09:00:00.000Z"),
      returnAt: new Date("2026-01-01T13:00:00.000Z"),
      seats: ["V01"],
    });
    await assert.rejects(
      () =>
        book({
          flightNumber: departed,
          travelClassCode: "VOYAGER",
          customer: customer("Past", "Flight", "past.flight@example.test"),
          passengers: [{ firstName: "Past", lastName: "Flight" }],
        }),
      FlightNotBookableError,
    );
  });

  it("does not let a cancelled claim block the seat, and does let active claims block it", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-CLAIM",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-05-01T09:00:00.000Z"),
      returnAt: new Date("2099-05-01T13:00:00.000Z"),
      seats: ["V01", "V02"],
    });
    await occupy(flightNumber, "V01", ReservationStatus.Cancelled, "CAN-CLAIM");
    await occupy(flightNumber, "V02", ReservationStatus.Held, "HLD-CLAIM");

    const confirmation = await book({
      flightNumber,
      travelClassCode: "VOYAGER",
      customer: customer("Reuse", "Seat", "reuse.seat@example.test"),
      passengers: [{ firstName: "Reuse", lastName: "Seat" }],
    });

    assert.deepEqual(
      confirmation.passengers.map((passenger) => passenger.accommodationCode),
      ["V01"],
    );
  });

  it("leaves no rows when there are not enough open seats", async () => {
    const ares = await prismaClient().flight.findFirstOrThrow({
      where: {
        voyage: { code: "ORB-07" },
        departureAt: new Date("2026-11-05T10:30:00.000Z"),
      },
    });
    const email = "too.many@example.test";

    await assert.rejects(
      () =>
        book({
          flightNumber: ares.flightNumber,
          travelClassCode: "VOYAGER_PLUS",
          customer: customer("Too", "Many", email),
          passengers: Array.from({ length: 8 }, (_, index) => ({
            firstName: "Guest",
            lastName: String(index + 1),
          })),
        }),
      InsufficientAvailabilityError,
    );
    assert.equal(
      await prismaClient().customer.count({ where: { email } }),
      0,
    );
  });

  it("gives concurrent single-seat bookings different accommodations", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-RACE-ONE",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-06-01T09:00:00.000Z"),
      returnAt: new Date("2099-06-01T13:00:00.000Z"),
      seats: ["V01", "V02"],
    });
    const results = await Promise.all([
      book(single(flightNumber, "race.one.a@example.test", "A")),
      book(single(flightNumber, "race.one.b@example.test", "B")),
    ]);
    const codes = results.flatMap((result) =>
      result.passengers.map((passenger) => passenger.accommodationCode),
    );

    assert.equal(new Set(codes).size, 2);
    assert.deepEqual([...codes].sort(), ["V01", "V02"]);
    await assertSingleOccupancy();
  });

  it("lets only one of two full-cabin bookings succeed", async () => {
    const flightNumber = await fixtureFlight({
      flightNumber: "VY-RACE-BOTH",
      status: FlightStatus.Scheduled,
      departureAt: new Date("2099-07-01T09:00:00.000Z"),
      returnAt: new Date("2099-07-01T13:00:00.000Z"),
      seats: ["V01", "V02"],
    });
    const results = await Promise.allSettled([
      book(pair(flightNumber, "race.both.a@example.test")),
      book(pair(flightNumber, "race.both.b@example.test")),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]?.status, "rejected");
    if (rejected[0]?.status === "rejected") {
      assert.ok(rejected[0].reason instanceof InsufficientAvailabilityError);
    }
    await assertSingleOccupancy();
  });

  it("retries a real confirmation-code collision and does not retry other unique violations", async () => {
    const bookings = createPrismaReservationBooking(prismaClient());
    let confirmationAttempts = 0;
    const retried = await bookings.transact(async () => {
      confirmationAttempts += 1;

      if (confirmationAttempts === 1) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { modelName: "Reservation", target: ["confirmationCode"] },
        });
      }

      return "retried";
    });
    assert.equal(retried, "retried");
    assert.equal(confirmationAttempts, 2);

    const earthlight = await firstFlight("ORB-02");
    let generatedCodes = 0;
    const ids = {
      newId: createRandomId,
      newConfirmationCode() {
        generatedCodes += 1;
        return generatedCodes === 1 ? "DLY-ARES" : `VYREAL${generatedCodes}`;
      },
    };
    const confirmation = await createConfirmedReservation(
      single(earthlight.flightNumber, "code.collision@example.test", "Code"),
      {
        bookings,
        ids,
        clock,
      },
    );
    assert.equal(generatedCodes >= 2, true);
    assert.notEqual(confirmation.confirmationCode, "DLY-ARES");

    let unrelatedAttempts = 0;
    await assert.rejects(() =>
      bookings.transact(async () => {
        unrelatedAttempts += 1;
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { modelName: "Flight", target: ["flightNumber"] },
        });
      }),
    );
    assert.equal(unrelatedAttempts, 1);
  });
});

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

async function firstFlight(voyageCode: string) {
  return prismaClient().flight.findFirstOrThrow({
    where: { voyage: { code: voyageCode } },
    orderBy: { departureAt: "asc" },
  });
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

async function occupy(
  flightNumber: string,
  accommodationCode: string,
  status: ReservationStatus,
  confirmationCode: string,
) {
  const prisma = prismaClient();
  const flight = await prisma.flight.findUniqueOrThrow({
    where: { flightNumber },
    include: { accommodations: true },
  });
  const accommodation = flight.accommodations.find(
    (seat) => seat.code === accommodationCode,
  );

  if (accommodation === undefined) {
    throw new Error(`Missing ${accommodationCode} on ${flightNumber}.`);
  }

  const timestamp = new Date("2099-01-01T00:00:00.000Z");
  const customer = createCustomer({
    id: createRandomId(),
    firstName: "Occupied",
    lastName: "Claim",
    email: `${confirmationCode.toLowerCase()}@example.test`,
    phone: "+1-555-0188",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const passenger = createPassenger({
    id: createRandomId(),
    firstName: "Occupied",
    lastName: "Claim",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const reservation = createReservation({
    id: createRandomId(),
    confirmationCode,
    customerId: customer.id,
    flightId: flight.id,
    travelClassId: accommodation.travelClassId,
    status,
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
}

function customer(firstName: string, lastName: string, email: string) {
  return {
    firstName,
    lastName,
    email,
    phone: "+1-555-0177",
  };
}

function single(
  flightNumber: string,
  email: string,
  lastName: string,
): BookingRequest {
  return {
    flightNumber,
    travelClassCode: "VOYAGER",
    customer: customer("Race", lastName, email),
    passengers: [{ firstName: "Race", lastName }],
  };
}

function pair(flightNumber: string, email: string): BookingRequest {
  return {
    flightNumber,
    travelClassCode: "VOYAGER",
    customer: customer("Race", "Pair", email),
    passengers: [
      { firstName: "One", lastName: "Pair" },
      { firstName: "Two", lastName: "Pair" },
    ],
  };
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
