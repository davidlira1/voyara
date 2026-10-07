import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { CustomerRepository } from "../../../application/ports/customer-repository.js";
import type { FlightRepository } from "../../../application/ports/flight-repository.js";
import type { PassengerRepository } from "../../../application/ports/passenger-repository.js";
import type { ReservationRepository } from "../../../application/ports/reservation-repository.js";
import type { TravelClassRepository } from "../../../application/ports/travel-class-repository.js";
import type { VehicleFamilyRepository } from "../../../application/ports/vehicle-family-repository.js";
import type { VehicleRepository } from "../../../application/ports/vehicle-repository.js";
import type { VoyageRepository } from "../../../application/ports/voyage-repository.js";
import { createCustomer } from "../../../domain/customers/customer.js";
import { createFlightAccommodation } from "../../../domain/flights/flight-accommodation.js";
import { createFlight } from "../../../domain/flights/flight.js";
import { FlightStatus } from "../../../domain/flights/flight-status.js";
import { createPassenger } from "../../../domain/passengers/passenger.js";
import { DomainInvariantError } from "../../../domain/shared/domain-error.js";
import {
  createFareMultiplier,
  createMoney,
} from "../../../domain/shared/money.js";
import { createReservationPassenger } from "../../../domain/reservations/reservation-passenger.js";
import { createReservation } from "../../../domain/reservations/reservation.js";
import { ReservationStatus } from "../../../domain/reservations/reservation-status.js";
import { createTravelClass } from "../../../domain/travel-classes/travel-class.js";
import { createVehicleFamilyTravelClass } from "../../../domain/vehicles/vehicle-family-travel-class.js";
import { createVehicleFamily } from "../../../domain/vehicles/vehicle-family.js";
import { createVehicle } from "../../../domain/vehicles/vehicle.js";
import { VehicleStatus } from "../../../domain/vehicles/vehicle-status.js";
import { createVoyage } from "../../../domain/voyages/voyage.js";
import { createRandomId } from "../../identity/random-id.js";
import { createPrismaClient, type PrismaClient } from "./client.js";
import { createPrismaCustomerRepository } from "./repositories/customer-repository.js";
import { createPrismaFlightRepository } from "./repositories/flight-repository.js";
import { createPrismaPassengerRepository } from "./repositories/passenger-repository.js";
import { createPrismaReservationRepository } from "./repositories/reservation-repository.js";
import { createPrismaTravelClassRepository } from "./repositories/travel-class-repository.js";
import { createPrismaVehicleFamilyRepository } from "./repositories/vehicle-family-repository.js";
import { createPrismaVehicleRepository } from "./repositories/vehicle-repository.js";
import { createPrismaVoyageRepository } from "./repositories/voyage-repository.js";
import { truncateAll } from "./truncate.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Prisma persistence", () => {
  let prisma: PrismaClient;
  let voyages: VoyageRepository;
  let travelClasses: TravelClassRepository;
  let families: VehicleFamilyRepository;
  let vehicles: VehicleRepository;
  let flights: FlightRepository;
  let customers: CustomerRepository;
  let passengers: PassengerRepository;
  let reservations: ReservationRepository;

  before(async () => {
    prisma = createPrismaClient();
    voyages = createPrismaVoyageRepository(prisma);
    travelClasses = createPrismaTravelClassRepository(prisma);
    families = createPrismaVehicleFamilyRepository(prisma);
    vehicles = createPrismaVehicleRepository(prisma);
    flights = createPrismaFlightRepository(prisma);
    customers = createPrismaCustomerRepository(prisma);
    passengers = createPrismaPassengerRepository(prisma);
    reservations = createPrismaReservationRepository(prisma);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  it("saves and reads a voyage, including a fare above the 32-bit cent ceiling", async () => {
    const voyage = createVoyage({
      id: createRandomId(),
      code: "ORB-07",
      name: "Ares",
      description: "Mars flyby with extended observation window",
      durationMinutes: 40 * 60,
      baseFare: createMoney(3_000_000_000),
    });

    await voyages.save(voyage);

    assert.match(voyage.id, uuidPattern);
    assert.deepEqual(await voyages.findById(voyage.id), voyage);
    assert.deepEqual(await voyages.findByCode("ORB-07"), voyage);
    assert.equal(await voyages.findByCode("ORB-MISSING"), null);
  });

  it("rejects a duplicate voyage code", async () => {
    const first = createVoyage({
      id: createRandomId(),
      code: "ORB-07",
      name: "Ares",
      description: "Mars flyby",
      durationMinutes: 2400,
      baseFare: createMoney(1_250_000),
    });
    const second = createVoyage({
      ...first,
      id: createRandomId(),
      name: "Ares copy",
    });

    await voyages.save(first);
    await assert.rejects(() => voyages.save(second));
  });

  it("rejects a voyage insert that omits the id", async () => {
    await assert.rejects(() =>
      prisma.$executeRawUnsafe(`
        INSERT INTO voyages (
          code, name, description, duration_minutes,
          base_fare_amount_minor, base_fare_currency
        )
        VALUES ('ORB-NOID', 'No Id', 'Missing identity', 60, 0, 'USD')
      `),
    );
  });

  it("rejects a non-positive voyage duration at the database", async () => {
    await assert.rejects(() =>
      prisma.$executeRawUnsafe(
        `
          INSERT INTO voyages (
            id, code, name, description, duration_minutes,
            base_fare_amount_minor, base_fare_currency
          )
          VALUES ($1::uuid, 'ORB-ZERO', 'Zero', 'Bad duration', 0, 0, 'USD')
        `,
        createRandomId(),
      ),
    );
  });

  it("saves a vehicle family with the travel classes it supports", async () => {
    const family = createVehicleFamily({
      id: createRandomId(),
      code: "ODYSSEY",
      name: "Odyssey",
    });
    const travelClass = createTravelClass({
      id: createRandomId(),
      code: "VOYAGER_PLUS",
      name: "Voyager+",
      fareMultiplier: createFareMultiplier(7, 5),
    });
    const celestial = createTravelClass({
      id: createRandomId(),
      code: "CELESTIAL",
      name: "Celestial",
      fareMultiplier: createFareMultiplier(5, 2),
    });
    const capacity = createVehicleFamilyTravelClass({
      id: createRandomId(),
      vehicleFamilyId: family.id,
      travelClassId: travelClass.id,
      capacity: 16,
    });

    await families.save(family);
    await travelClasses.save(travelClass);
    await travelClasses.save(celestial);
    await families.saveTravelClass(capacity);

    assert.deepEqual(await families.findByCode("ODYSSEY"), family);
    assert.deepEqual(await travelClasses.findByCode("VOYAGER_PLUS"), travelClass);
    assert.deepEqual(await travelClasses.findById(celestial.id), celestial);
    assert.deepEqual(await families.findTravelClasses(family.id), [capacity]);
  });

  it("saves a flight and rejects a duplicate flight number or missing parent", async () => {
    const graph = await saveFlightParents({
      voyages,
      families,
      travelClasses,
      vehicles,
    });
    const departureAt = new Date("2087-11-12T08:30:00.123Z");
    const returnAt = new Date("2087-11-14T00:30:00.000Z");
    const flight = createFlight({
      id: createRandomId(),
      flightNumber: "VY-482",
      voyageId: graph.voyage.id,
      vehicleId: graph.vehicle.id,
      departureAt,
      returnAt,
      status: FlightStatus.Scheduled,
    });

    await flights.save(flight);

    const stored = await flights.findByFlightNumber("VY-482");
    assert.deepEqual(stored, flight);
    assert.equal(stored?.departureAt.getTime(), departureAt.getTime());
    assert.equal(stored?.returnAt.getTime(), returnAt.getTime());

    await assert.rejects(() =>
      flights.save(
        createFlight({
          ...flight,
          id: createRandomId(),
        }),
      ),
    );

    await assert.rejects(() =>
      flights.save(
        createFlight({
          id: createRandomId(),
          flightNumber: "VY-404",
          voyageId: createRandomId(),
          vehicleId: graph.vehicle.id,
          departureAt,
          returnAt,
          status: FlightStatus.Scheduled,
        }),
      ),
    );
  });

  it("saves a reservation with passengers and rejects an accommodation from another flight", async () => {
    const graph = await saveFlightParents({
      voyages,
      families,
      travelClasses,
      vehicles,
    });
    const departureAt = new Date("2087-11-12T08:30:00.000Z");
    const returnAt = new Date("2087-11-14T00:30:00.456Z");
    const flight = createFlight({
      id: createRandomId(),
      flightNumber: "VY-482",
      voyageId: graph.voyage.id,
      vehicleId: graph.vehicle.id,
      departureAt,
      returnAt,
      status: FlightStatus.Scheduled,
    });
    const otherFlight = createFlight({
      id: createRandomId(),
      flightNumber: "VY-491",
      voyageId: graph.voyage.id,
      vehicleId: graph.vehicle.id,
      departureAt,
      returnAt,
      status: FlightStatus.Scheduled,
    });
    const accommodation = createFlightAccommodation({
      id: createRandomId(),
      flightId: flight.id,
      travelClassId: graph.travelClass.id,
      code: "P01",
    });
    const otherAccommodation = createFlightAccommodation({
      id: createRandomId(),
      flightId: otherFlight.id,
      travelClassId: graph.travelClass.id,
      code: "P01",
    });
    const createdAt = new Date("2087-10-01T15:04:05.123Z");
    const customer = createCustomer({
      id: createRandomId(),
      firstName: "David",
      lastName: "Lira",
      email: "david@example.com",
      phone: "+1-415-555-0100",
      createdAt,
      updatedAt: createdAt,
    });
    const passenger = createPassenger({
      id: createRandomId(),
      firstName: "David",
      lastName: "Lira",
      createdAt,
      updatedAt: createdAt,
    });
    const reservation = createReservation({
      id: createRandomId(),
      confirmationCode: "VY7A2C",
      customerId: customer.id,
      flightId: flight.id,
      travelClassId: graph.travelClass.id,
      status: ReservationStatus.Confirmed,
      totalPrice: createMoney(1_750_000),
      createdAt,
      updatedAt: createdAt,
    });
    const assignment = createReservationPassenger({
      id: createRandomId(),
      reservationId: reservation.id,
      passengerId: passenger.id,
      flightAccommodationId: accommodation.id,
      fare: createMoney(1_750_000),
    });

    await flights.save(flight);
    await flights.save(otherFlight);
    await flights.saveAccommodation(accommodation);
    await flights.saveAccommodation(otherAccommodation);
    await customers.save(customer);
    await passengers.save(passenger);
    await reservations.save(reservation);
    await reservations.savePassenger(assignment);

    assert.deepEqual(await reservations.findByConfirmationCode("VY7A2C"), reservation);
    assert.equal(
      (await reservations.findById(reservation.id))?.createdAt.getTime(),
      createdAt.getTime(),
    );
    assert.deepEqual(await reservations.findPassengers(reservation.id), [
      assignment,
    ]);
    assert.deepEqual(await flights.findAccommodations(flight.id), [
      accommodation,
    ]);
    assert.deepEqual(await customers.findById(customer.id), customer);
    assert.deepEqual(await passengers.findById(passenger.id), passenger);

    await assert.rejects(
      () =>
        reservations.savePassenger(
          createReservationPassenger({
            id: createRandomId(),
            reservationId: reservation.id,
            passengerId: passenger.id,
            flightAccommodationId: otherAccommodation.id,
            fare: createMoney(1_750_000),
          }),
        ),
      DomainInvariantError,
    );
  });
});

async function saveFlightParents(repositories: {
  voyages: VoyageRepository;
  families: VehicleFamilyRepository;
  travelClasses: TravelClassRepository;
  vehicles: VehicleRepository;
}): Promise<{
  voyage: ReturnType<typeof createVoyage>;
  travelClass: ReturnType<typeof createTravelClass>;
  vehicle: ReturnType<typeof createVehicle>;
}> {
  const voyage = createVoyage({
    id: createRandomId(),
    code: "ORB-07",
    name: "Ares",
    description: "Mars flyby",
    durationMinutes: 2400,
    baseFare: createMoney(1_250_000),
  });
  const family = createVehicleFamily({
    id: createRandomId(),
    code: "ODYSSEY",
    name: "Odyssey",
  });
  const travelClass = createTravelClass({
    id: createRandomId(),
    code: "VOYAGER",
    name: "Voyager",
    fareMultiplier: createFareMultiplier(1, 1),
  });
  const vehicle = createVehicle({
    id: createRandomId(),
    code: "ODY-02",
    name: "Odyssey-02",
    vehicleFamilyId: family.id,
    status: VehicleStatus.Active,
  });

  await repositories.voyages.save(voyage);
  await repositories.families.save(family);
  await repositories.travelClasses.save(travelClass);
  await repositories.vehicles.save(vehicle);

  return { voyage, travelClass, vehicle };
}
