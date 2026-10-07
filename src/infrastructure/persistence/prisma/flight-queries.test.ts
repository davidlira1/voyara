import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Clock } from "../../../application/clock.js";
import { FlightNotFoundError, VoyageNotFoundError } from "../../../application/errors.js";
import type { FlightSearchCriteria } from "../../../application/flights/flight-search-criteria.js";
import {
  getFlight,
  getFlightAvailability,
  searchFlights,
} from "../../../application/flights/flight-queries.js";
import type { FlightQueryRepository } from "../../../application/ports/flight-query-repository.js";
import { getVoyage, listVoyages } from "../../../application/voyages/voyage-queries.js";
import { createFlightAccommodation } from "../../../domain/flights/flight-accommodation.js";
import { createFlight } from "../../../domain/flights/flight.js";
import { FlightStatus } from "../../../domain/flights/flight-status.js";
import { createPassenger } from "../../../domain/passengers/passenger.js";
import { createMoney } from "../../../domain/shared/money.js";
import { createReservationPassenger } from "../../../domain/reservations/reservation-passenger.js";
import { createReservation } from "../../../domain/reservations/reservation.js";
import { ReservationStatus } from "../../../domain/reservations/reservation-status.js";
import { createRandomId } from "../../identity/random-id.js";
import { seedDatabase } from "../../seed/seed-database.js";
import { createPrismaClient, type PrismaClient } from "./client.js";
import { createPrismaFlightQueryRepository } from "./repositories/flight-query-repository.js";
import { createPrismaFlightRepository } from "./repositories/flight-repository.js";
import { createPrismaPassengerRepository } from "./repositories/passenger-repository.js";
import { createPrismaReservationRepository } from "./repositories/reservation-repository.js";
import { createPrismaTravelClassRepository } from "./repositories/travel-class-repository.js";
import { createPrismaVehicleRepository } from "./repositories/vehicle-repository.js";
import { createPrismaVoyageQueryRepository } from "./repositories/voyage-query-repository.js";
import { createPrismaVoyageRepository } from "./repositories/voyage-repository.js";

const anchor = new Date("2026-10-07T00:00:00.000Z");
const seedClock: Clock = {
  now() {
    return new Date(anchor);
  },
};

function search(
  flights: FlightQueryRepository,
  criteria: FlightSearchCriteria,
  clock: Clock = seedClock,
) {
  return searchFlights(flights, criteria, clock);
}

describe("flight and voyage queries", { timeout: 180_000 }, () => {
  let prisma: PrismaClient;

  before(async () => {
    prisma = createPrismaClient();
    await seedDatabase({ anchor, prisma });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("lists the ten voyages and reads Ares", async () => {
    const voyages = createPrismaVoyageQueryRepository(prisma);
    const listed = await listVoyages(voyages);

    assert.deepEqual(
      listed.map((voyage) => voyage.code),
      [
        "ORB-01",
        "ORB-02",
        "ORB-03",
        "ORB-04",
        "ORB-05",
        "ORB-06",
        "ORB-07",
        "ORB-08",
        "ORB-09",
        "ORB-10",
      ],
    );
    assert.equal("id" in listed[0]!, false);

    const ares = await getVoyage(voyages, "ORB-07");
    assert.equal(ares.name, "Ares");
    assert.equal(ares.durationMinutes, 2400);
    assert.equal(ares.baseFare.amountMinor, 1_250_000);
    await assert.rejects(
      () => getVoyage(voyages, "ORB-99"),
      VoyageNotFoundError,
    );
  });

  it("returns Ares flights in departure order and filters by date", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const ares = await search(flights, {
      voyageCode: "ORB-07",
      limit: 100,
    });

    assert.ok(ares.length > 1);
    assert.ok(ares.every((flight) => flight.voyage.code === "ORB-07"));

    for (let index = 1; index < ares.length; index += 1) {
      const previous = ares[index - 1];
      const current = ares[index];

      if (previous === undefined || current === undefined) {
        continue;
      }

      assert.ok(
        previous.departureAt.getTime() < current.departureAt.getTime() ||
          (previous.departureAt.getTime() === current.departureAt.getTime() &&
            previous.flightNumber <= current.flightNumber),
      );
    }

    const onDollyDay = await search(flights, {
      voyageCode: "ORB-07",
      departureFrom: new Date("2026-11-05T00:00:00.000Z"),
      departureTo: new Date("2026-11-05T23:59:59.999Z"),
    });

    assert.equal(onDollyDay.length, 1);
    assert.equal(
      onDollyDay[0]?.departureAt.toISOString(),
      "2026-11-05T10:30:00.000Z",
    );
    assert.notEqual(
      onDollyDay[0]?.flightNumber,
      ares[0]?.flightNumber,
    );
  });

  it("prices classes from the voyage fare and current availability", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const [dollyFlight] = await search(flights, {
      voyageCode: "ORB-07",
      travelClassCode: "VOYAGER_PLUS",
      passengerCount: 3,
      departureFrom: new Date("2026-11-05T00:00:00.000Z"),
      departureTo: new Date("2026-11-05T23:59:59.999Z"),
    });

    if (dollyFlight === undefined) {
      throw new Error("Expected Dolly's Ares flight.");
    }

    const voyager = classOn(dollyFlight, "VOYAGER");
    const voyagerPlus = classOn(dollyFlight, "VOYAGER_PLUS");
    const celestial = classOn(dollyFlight, "CELESTIAL");
    assert.equal(voyager.farePerPassenger.amountMinor, 1_250_000);
    assert.equal(voyagerPlus.farePerPassenger.amountMinor, 1_750_000);
    assert.equal(celestial.farePerPassenger.amountMinor, 3_125_000);
    assert.equal(voyagerPlus.availableCount, 7);

    const tooLarge = await search(flights, {
      voyageCode: "ORB-07",
      travelClassCode: "VOYAGER_PLUS",
      passengerCount: 8,
      departureFrom: new Date("2026-11-05T00:00:00.000Z"),
      departureTo: new Date("2026-11-05T23:59:59.999Z"),
    });
    assert.equal(tooLarge.length, 0);

    const meridianCelestial = await search(flights, {
      voyageCode: "ORB-01",
      travelClassCode: "CELESTIAL",
      limit: 5,
    });
    assert.equal(meridianCelestial.length, 0);
  });

  it("derives availability from held, confirmed, and cancelled claims", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const [earthlight] = await search(flights, {
      voyageCode: "ORB-01",
      limit: 1,
    });
    const [polar] = await search(flights, {
      voyageCode: "ORB-03",
      limit: 1,
    });
    const [solar] = await search(flights, {
      voyageCode: "ORB-05",
      limit: 1,
    });
    const [europa] = await search(flights, {
      voyageCode: "ORB-08",
      limit: 1,
    });

    if (
      earthlight === undefined ||
      polar === undefined ||
      solar === undefined ||
      europa === undefined
    ) {
      throw new Error("Expected the first flight of each voyage.");
    }

    assert.equal(classOn(earthlight, "VOYAGER").availableCount, 47);
    assert.equal(classOn(polar, "VOYAGER").availableCount, 40);
    assert.equal(classOn(solar, "VOYAGER").availableCount, 35);
    assert.equal(classOn(europa, "VOYAGER").availableCount, 0);
    assert.equal(classOn(europa, "VOYAGER_PLUS").availableCount, 0);
    assert.equal(classOn(europa, "CELESTIAL").availableCount, 0);

    const bookableEuropa = await search(flights, {
      voyageCode: "ORB-08",
      passengerCount: 1,
      departureFrom: new Date("2026-10-08T00:00:00.000Z"),
      departureTo: new Date("2026-10-08T23:59:59.999Z"),
    });
    assert.equal(bookableEuropa.length, 0);
  });

  it("reads one flight and its open accommodation codes", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const [dollyFlight] = await search(flights, {
      voyageCode: "ORB-07",
      departureFrom: new Date("2026-11-05T00:00:00.000Z"),
      departureTo: new Date("2026-11-05T23:59:59.999Z"),
    });

    if (dollyFlight === undefined) {
      throw new Error("Expected Dolly's Ares flight.");
    }

    const detail = await getFlight(flights, dollyFlight.flightNumber);
    assert.equal(detail.voyage.name, "Ares");
    assert.equal(detail.spacecraft.familyCode, "ODYSSEY");
    assert.equal(detail.spacecraft.code.startsWith("Odyssey-"), true);

    const availability = await getFlightAvailability(
      flights,
      dollyFlight.flightNumber,
    );
    const voyagerPlus = availability.classes.find(
      (travelClass) => travelClass.code === "VOYAGER_PLUS",
    );
    assert.equal(voyagerPlus?.totalCount, 16);
    assert.equal(voyagerPlus?.availableCount, 7);
    assert.deepEqual(voyagerPlus?.availableAccommodationCodes, [
      "P04",
      "P08",
      "P09",
      "P10",
      "P12",
      "P13",
      "P14",
    ]);
    await assert.rejects(
      () => getFlight(flights, "VY-MISSING"),
      FlightNotFoundError,
    );
  });

  it("does not add seats from different classes, and completed claims stay occupied", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const voyage = await createPrismaVoyageRepository(prisma).findByCode(
      "ORB-01",
    );
    const vehicle = await createPrismaVehicleRepository(prisma).findByCode(
      "Meridian-01",
    );
    const voyager = await createPrismaTravelClassRepository(prisma).findByCode(
      "VOYAGER",
    );
    const voyagerPlus = await createPrismaTravelClassRepository(
      prisma,
    ).findByCode("VOYAGER_PLUS");

    if (
      voyage === null ||
      vehicle === null ||
      voyager === null ||
      voyagerPlus === null
    ) {
      throw new Error("Seed catalog is missing a fixture parent.");
    }

    const flight = createFlight({
      id: createRandomId(),
      flightNumber: "VY-SPLIT",
      voyageId: voyage.id,
      vehicleId: vehicle.id,
      departureAt: new Date("2099-01-01T09:00:00.000Z"),
      returnAt: new Date("2099-01-01T13:00:00.000Z"),
      status: FlightStatus.Scheduled,
    });
    await createPrismaFlightRepository(prisma).save(flight);
    const seats = ["V01", "V02", "P01", "P02"];
    const seatIds = new Map<string, string>();

    for (const code of seats) {
      const id = createRandomId();
      seatIds.set(code, id);
      await createPrismaFlightRepository(prisma).saveAccommodation(
        createFlightAccommodation({
          id,
          flightId: flight.id,
          travelClassId: code.startsWith("V") ? voyager.id : voyagerPlus.id,
          code,
        }),
      );
    }

    const window = {
      voyageCode: "ORB-01",
      departureFrom: new Date("2099-01-01T00:00:00.000Z"),
      departureTo: new Date("2099-01-01T23:59:59.999Z"),
    };
    assert.equal(
      (await search(flights, { ...window, passengerCount: 4 })).length,
      0,
    );
    assert.equal(
      (await search(flights, { ...window, passengerCount: 2 }))[0]
        ?.flightNumber,
      "VY-SPLIT",
    );

    const createdAt = new Date("2099-01-01T00:00:00.000Z");
    const passenger = createPassenger({
      id: createRandomId(),
      firstName: "Completed",
      lastName: "Claim",
      createdAt,
      updatedAt: createdAt,
    });
    await createPrismaPassengerRepository(prisma).save(passenger);
    const reservation = createReservation({
      id: createRandomId(),
      confirmationCode: "CMP-SPLIT",
      customerId: (
        await prisma.customer.findFirstOrThrow()
      ).id,
      flightId: flight.id,
      travelClassId: voyager.id,
      status: ReservationStatus.Completed,
      totalPrice: createMoney(120_000),
      createdAt,
      updatedAt: createdAt,
    });
    const reservations = createPrismaReservationRepository(prisma);
    await reservations.save(reservation);
    await reservations.savePassenger(
      createReservationPassenger({
        id: createRandomId(),
        reservationId: reservation.id,
        passengerId: passenger.id,
        flightAccommodationId: requiredSeat(seatIds, "V01"),
        fare: createMoney(120_000),
      }),
    );

    const availability = await getFlightAvailability(flights, "VY-SPLIT");
    assert.equal(
      availability.classes.find((travelClass) => travelClass.code === "VOYAGER")
        ?.availableCount,
      1,
    );
    assert.deepEqual(
      availability.classes.find((travelClass) => travelClass.code === "VOYAGER")
        ?.availableAccommodationCodes,
      ["V02"],
    );
  });

  it("excludes scheduled flights that have already departed", async () => {
    const flights = createPrismaFlightQueryRepository(prisma);
    const voyage = await createPrismaVoyageRepository(prisma).findByCode(
      "ORB-01",
    );
    const earlierVehicle = await createPrismaVehicleRepository(
      prisma,
    ).findByCode("Meridian-01");
    const laterVehicle = await createPrismaVehicleRepository(prisma).findByCode(
      "Meridian-02",
    );

    if (voyage === null || earlierVehicle === null || laterVehicle === null) {
      throw new Error("Seed catalog is missing a fixture parent.");
    }

    await createPrismaFlightRepository(prisma).save(
      createFlight({
        id: createRandomId(),
        flightNumber: "VY-PAST",
        voyageId: voyage.id,
        vehicleId: earlierVehicle.id,
        departureAt: new Date("2026-06-01T08:00:00.000Z"),
        returnAt: new Date("2026-06-01T12:00:00.000Z"),
        status: FlightStatus.Scheduled,
      }),
    );
    await createPrismaFlightRepository(prisma).save(
      createFlight({
        id: createRandomId(),
        flightNumber: "VY-FUTURE",
        voyageId: voyage.id,
        vehicleId: laterVehicle.id,
        departureAt: new Date("2026-06-02T08:00:00.000Z"),
        returnAt: new Date("2026-06-02T12:00:00.000Z"),
        status: FlightStatus.Scheduled,
      }),
    );

    const window = {
      voyageCode: "ORB-01",
      departureFrom: new Date("2026-06-01T00:00:00.000Z"),
      departureTo: new Date("2026-06-03T00:00:00.000Z"),
    };
    const between = {
      now: () => new Date("2026-06-01T12:00:00.000Z"),
    };
    const beforeBoth = {
      now: () => new Date("2026-05-01T00:00:00.000Z"),
    };

    assert.deepEqual(
      (await search(flights, window, between)).map(
        (flight) => flight.flightNumber,
      ),
      ["VY-FUTURE"],
    );
    assert.deepEqual(
      (await search(flights, window, beforeBoth)).map(
        (flight) => flight.flightNumber,
      ),
      ["VY-PAST", "VY-FUTURE"],
    );
    assert.equal((await getFlight(flights, "VY-PAST")).flightNumber, "VY-PAST");
  });
});

function classOn(
  flight: { classes: readonly { code: string; availableCount: number; farePerPassenger: { amountMinor: number } }[] },
  code: string,
) {
  const travelClass = flight.classes.find((item) => item.code === code);

  if (travelClass === undefined) {
    throw new Error(`Missing class ${code}.`);
  }

  return travelClass;
}

function requiredSeat(seatIds: ReadonlyMap<string, string>, code: string): string {
  const id = seatIds.get(code);

  if (id === undefined) {
    throw new Error(`Missing seat ${code}.`);
  }

  return id;
}
