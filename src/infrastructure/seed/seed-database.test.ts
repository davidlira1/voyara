import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { familyCapacityCatalog } from "./catalog.js";
import { seedDatabase, type SeedSummary } from "./seed-database.js";
import {
  createPrismaClient,
  type PrismaClient,
} from "../persistence/prisma/client.js";

const anchor = new Date("2026-10-07T15:00:00.000Z");

describe("seed database", { timeout: 180_000 }, () => {
  let prisma: PrismaClient;
  let summary: SeedSummary;

  before(async () => {
    prisma = createPrismaClient();
    summary = await seedDatabase({ anchor, prisma });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("resets and rebuilds the catalog", async () => {
    assert.equal(summary.counts.travelClasses, 3);
    assert.equal(summary.counts.voyages, 10);
    assert.equal(summary.counts.vehicleFamilies, 4);
    assert.equal(summary.counts.vehicles, 12);

    const meridian = await prisma.vehicleFamily.findUniqueOrThrow({
      where: { code: "MERIDIAN" },
      include: { travelClasses: { include: { travelClass: true } } },
    });

    assert.equal(meridian.travelClasses.length, 2);
    assert.equal(
      meridian.travelClasses.some(
        (capacity) => capacity.travelClass.code === "CELESTIAL",
      ),
      false,
    );

    for (const expected of familyCapacityCatalog) {
      const row = await prisma.vehicleFamilyTravelClass.findFirstOrThrow({
        where: {
          vehicleFamily: { code: expected.familyCode },
          travelClass: { code: expected.travelClassCode },
        },
      });
      assert.equal(row.capacity, expected.capacity);
    }
  });

  it("fills the horizon and matches family inventory", async () => {
    const bounds = await prisma.flight.aggregate({
      _min: { departureAt: true },
      _max: { departureAt: true },
    });
    assert.ok(
      (bounds._min.departureAt?.getTime() ?? 0) >=
        Date.parse("2026-10-08T00:00:00.000Z"),
    );
    assert.ok(
      (bounds._max.departureAt?.getTime() ?? 0) >=
        Date.parse("2027-10-01T00:00:00.000Z"),
    );

    const inverted = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM flights
      WHERE return_at <= departure_at
    `;
    assert.equal(inverted[0]?.count, 0n);

    const flightNumbers = await prisma.flight.findMany({
      select: { flightNumber: true },
    });
    assert.equal(
      new Set(flightNumbers.map((flight) => flight.flightNumber)).size,
      flightNumbers.length,
    );

    const earthlight = await prisma.flight.findFirstOrThrow({
      where: { voyage: { code: "ORB-01" } },
      include: {
        vehicle: { include: { vehicleFamily: true } },
        accommodations: { include: { travelClass: true } },
      },
    });
    assert.equal(earthlight.vehicle.vehicleFamily.code, "MERIDIAN");
    assert.equal(earthlight.accommodations.length, 72);
    assert.equal(
      earthlight.accommodations.some(
        (accommodation) => accommodation.travelClass.code === "CELESTIAL",
      ),
      false,
    );
  });

  it("stores Dolly, single active claims, and the occupancy fixtures", async () => {
    assert.equal(summary.dolly.customerName, "Dolly Hart");
    assert.equal(summary.dolly.voyageCode, "ORB-07");
    assert.equal(summary.dolly.travelClassCode, "VOYAGER_PLUS");
    assert.equal(summary.dolly.status, "CONFIRMED");
    assert.equal(
      summary.dolly.departureAt.toISOString(),
      "2026-11-05T10:30:00.000Z",
    );
    assert.deepEqual(summary.dolly.accommodations, ["P01", "P02", "P03"]);
    assert.equal(summary.dolly.totalPriceMinor, 5_250_000);

    const reservations = await prisma.reservation.findMany({
      include: { passengers: true },
    });

    for (const reservation of reservations) {
      const sum = reservation.passengers.reduce(
        (total, passenger) => total + passenger.fareAmountMinor,
        0n,
      );
      assert.equal(reservation.totalPriceAmountMinor, sum);
    }

    const polar = await prisma.reservation.findUniqueOrThrow({
      where: { confirmationCode: "RIL-POL" },
      include: { flight: true },
    });
    const polarSeat = await prisma.flightAccommodation.findFirstOrThrow({
      where: { flightId: polar.flightId, code: "V01" },
      include: {
        passengers: { include: { reservation: true } },
      },
    });
    assert.equal(polarSeat.passengers.length, 2);
    assert.equal(
      polarSeat.passengers.filter((passenger) =>
        passenger.reservation.status === "HELD" ||
        passenger.reservation.status === "CONFIRMED",
      ).length,
      1,
    );

    const activeClaims = await prisma.reservationPassenger.groupBy({
      by: ["flightAccommodationId"],
      where: {
        reservation: { status: { in: ["HELD", "CONFIRMED"] } },
      },
      _count: { _all: true },
    });
    assert.equal(
      activeClaims.some((claim) => claim._count._all > 1),
      false,
    );

    const europa = await prisma.reservation.findUniqueOrThrow({
      where: { confirmationCode: "EUR-V" },
    });
    const europaSeats = await prisma.flightAccommodation.count({
      where: { flightId: europa.flightId },
    });
    const europaClaims = await prisma.reservationPassenger.count({
      where: {
        reservation: {
          flightId: europa.flightId,
          status: { in: ["HELD", "CONFIRMED"] },
        },
      },
    });
    assert.equal(europaClaims, europaSeats);

    const titan = await prisma.reservation.findUniqueOrThrow({
      where: { confirmationCode: "TIT-C" },
    });
    const titanCelestial = await prisma.flightAccommodation.findMany({
      where: {
        flightId: titan.flightId,
        travelClass: { code: "CELESTIAL" },
      },
      include: {
        passengers: { include: { reservation: true } },
      },
    });
    const openCelestial = titanCelestial.filter(
      (accommodation) =>
        !accommodation.passengers.some(
          (passenger) =>
            passenger.reservation.status === "HELD" ||
            passenger.reservation.status === "CONFIRMED",
        ),
    );
    assert.equal(openCelestial.length, 2);

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: (await prisma.reservation.findUniqueOrThrow({
        where: { confirmationCode: "DLY-ARES" },
      })).customerId },
    });
    assert.equal(customer.email, "dolly.hart@example.test");
  });

  it("rebuilds the same logical schedule instead of duplicating it", async () => {
    const before = await flightSignature();
    const again = await seedDatabase({ anchor, prisma });
    const after = await flightSignature();

    assert.deepEqual(after, before);
    assert.equal(again.counts.flights, summary.counts.flights);
    assert.equal(again.counts.voyages, 10);
    assert.equal(again.counts.reservations, summary.counts.reservations);
    assert.equal(
      again.dolly.departureAt.toISOString(),
      summary.dolly.departureAt.toISOString(),
    );
  });
});

async function flightSignature(): Promise<string[]> {
  const prisma = createPrismaClient();

  try {
    const flights = await prisma.flight.findMany({
      include: { voyage: true, vehicle: true },
      orderBy: { flightNumber: "asc" },
    });

    return flights.map(
      (flight) =>
        `${flight.flightNumber}|${flight.voyage.code}|${flight.vehicle.code}|${flight.departureAt.toISOString()}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
