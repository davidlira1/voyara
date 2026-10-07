import { createCustomer } from "../../domain/customers/customer.js";
import { createFlightAccommodation } from "../../domain/flights/flight-accommodation.js";
import { createFlight } from "../../domain/flights/flight.js";
import { FlightStatus } from "../../domain/flights/flight-status.js";
import { createPassenger } from "../../domain/passengers/passenger.js";
import {
  createFareMultiplier,
  createMoney,
  multiplyMoney,
} from "../../domain/shared/money.js";
import { createReservationPassenger } from "../../domain/reservations/reservation-passenger.js";
import { createReservation } from "../../domain/reservations/reservation.js";
import { createTravelClass } from "../../domain/travel-classes/travel-class.js";
import { createVehicleFamilyTravelClass } from "../../domain/vehicles/vehicle-family-travel-class.js";
import { createVehicleFamily } from "../../domain/vehicles/vehicle-family.js";
import { createVehicle } from "../../domain/vehicles/vehicle.js";
import { VehicleStatus } from "../../domain/vehicles/vehicle-status.js";
import { createVoyage } from "../../domain/voyages/voyage.js";
import { createRandomId } from "../identity/random-id.js";
import {
  createPrismaClient,
  type PrismaClient,
} from "../persistence/prisma/client.js";
import { flightAccommodationToPersistence } from "../persistence/prisma/mappers/flight-mapper.js";
import { flightToPersistence } from "../persistence/prisma/mappers/flight-mapper.js";
import { createPrismaCustomerRepository } from "../persistence/prisma/repositories/customer-repository.js";
import { createPrismaPassengerRepository } from "../persistence/prisma/repositories/passenger-repository.js";
import { createPrismaReservationRepository } from "../persistence/prisma/repositories/reservation-repository.js";
import { createPrismaTravelClassRepository } from "../persistence/prisma/repositories/travel-class-repository.js";
import { createPrismaVehicleFamilyRepository } from "../persistence/prisma/repositories/vehicle-family-repository.js";
import { createPrismaVehicleRepository } from "../persistence/prisma/repositories/vehicle-repository.js";
import { createPrismaVoyageRepository } from "../persistence/prisma/repositories/voyage-repository.js";
import { truncateAll } from "../persistence/prisma/truncate.js";
import {
  familyCapacityCatalog,
  travelClassCatalog,
  vehicleCatalog,
  vehicleFamilyCatalog,
  voyageByCode,
  voyageCatalog,
} from "./catalog.js";
import { buildDemoScenarios } from "./demo-scenarios.js";
import {
  generateSchedule,
  normalizeUtcDay,
  type SkippedCandidate,
} from "./schedule.js";

export type DollySeed = {
  readonly confirmationCode: string;
  readonly customerName: string;
  readonly email: string;
  readonly flightNumber: string;
  readonly voyageCode: string;
  readonly voyageName: string;
  readonly vehicleCode: string;
  readonly travelClassCode: string;
  readonly departureAt: Date;
  readonly status: string;
  readonly totalPriceMinor: number;
  readonly accommodations: readonly string[];
  readonly passengers: readonly string[];
};

export type SeedSummary = {
  readonly anchor: Date;
  readonly counts: {
    readonly travelClasses: number;
    readonly voyages: number;
    readonly vehicleFamilies: number;
    readonly vehicles: number;
    readonly familyCapacities: number;
    readonly flights: number;
    readonly accommodations: number;
    readonly customers: number;
    readonly passengers: number;
    readonly reservations: number;
    readonly reservationPassengers: number;
  };
  readonly skipped: readonly SkippedCandidate[];
  readonly dolly: DollySeed;
};

export async function seedDatabase(options: {
  anchor: Date;
  prisma?: PrismaClient;
}): Promise<SeedSummary> {
  const prisma = options.prisma ?? createPrismaClient();
  const ownsClient = options.prisma === undefined;
  const anchor = normalizeUtcDay(options.anchor);
  const timestamp = anchor;

  try {
    await truncateAll(prisma);

    const travelClasses = createPrismaTravelClassRepository(prisma);
    const voyages = createPrismaVoyageRepository(prisma);
    const families = createPrismaVehicleFamilyRepository(prisma);
    const vehicles = createPrismaVehicleRepository(prisma);
    const customers = createPrismaCustomerRepository(prisma);
    const passengers = createPrismaPassengerRepository(prisma);
    const reservations = createPrismaReservationRepository(prisma);

    const travelClassIds = new Map<string, string>();

    for (const travelClass of travelClassCatalog) {
      const id = createRandomId();
      await travelClasses.save(
        createTravelClass({
          id,
          code: travelClass.code,
          name: travelClass.name,
          fareMultiplier: createFareMultiplier(
            travelClass.numerator,
            travelClass.denominator,
          ),
        }),
      );
      travelClassIds.set(travelClass.code, id);
    }

    const voyageIds = new Map<string, string>();

    for (const voyage of voyageCatalog) {
      const id = createRandomId();
      await voyages.save(
        createVoyage({
          id,
          code: voyage.code,
          name: voyage.name,
          description: voyage.description,
          durationMinutes: voyage.durationMinutes,
          baseFare: createMoney(voyage.baseFareMinor),
        }),
      );
      voyageIds.set(voyage.code, id);
    }

    const familyIds = new Map<string, string>();

    for (const family of vehicleFamilyCatalog) {
      const id = createRandomId();
      await families.save(
        createVehicleFamily({
          id,
          code: family.code,
          name: family.name,
        }),
      );
      familyIds.set(family.code, id);
    }

    for (const capacity of familyCapacityCatalog) {
      const vehicleFamilyId = requiredId(familyIds, capacity.familyCode);
      const travelClassId = requiredId(
        travelClassIds,
        capacity.travelClassCode,
      );
      await families.saveTravelClass(
        createVehicleFamilyTravelClass({
          id: createRandomId(),
          vehicleFamilyId,
          travelClassId,
          capacity: capacity.capacity,
        }),
      );
    }

    const vehicleIds = new Map<string, string>();

    for (const vehicle of vehicleCatalog) {
      const id = createRandomId();
      await vehicles.save(
        createVehicle({
          id,
          code: vehicle.code,
          name: vehicle.name,
          vehicleFamilyId: requiredId(familyIds, vehicle.familyCode),
          status: VehicleStatus.Active,
        }),
      );
      vehicleIds.set(vehicle.code, id);
    }

    const schedule = generateSchedule(anchor);
    const flightRows: Array<ReturnType<typeof flightToPersistence>> = [];
    const accommodationRows: Array<
      ReturnType<typeof flightAccommodationToPersistence>
    > = [];
    const flightIdByNumber = new Map<string, string>();
    const accommodationIdByKey = new Map<string, string>();

    for (const scheduled of schedule.flights) {
      const flight = createFlight({
        id: createRandomId(),
        flightNumber: scheduled.flightNumber,
        voyageId: requiredId(voyageIds, scheduled.voyageCode),
        vehicleId: requiredId(vehicleIds, scheduled.vehicleCode),
        departureAt: scheduled.departureAt,
        returnAt: scheduled.returnAt,
        status: FlightStatus.Scheduled,
      });
      flightRows.push(flightToPersistence(flight));
      flightIdByNumber.set(flight.flightNumber, flight.id);

      for (const accommodation of scheduled.accommodations) {
        const row = createFlightAccommodation({
          id: createRandomId(),
          flightId: flight.id,
          travelClassId: requiredId(
            travelClassIds,
            accommodation.travelClassCode,
          ),
          code: accommodation.code,
        });
        accommodationRows.push(flightAccommodationToPersistence(row));
        accommodationIdByKey.set(
          `${flight.flightNumber}:${accommodation.code}`,
          row.id,
        );
      }
    }

    await createInChunks(flightRows, (data) =>
      prisma.flight.createMany({ data }),
    );
    await createInChunks(accommodationRows, (data) =>
      prisma.flightAccommodation.createMany({ data }),
    );

    const plans = buildDemoScenarios(schedule, anchor);
    const customerIds = new Map<string, string>();

    for (const plan of plans) {
      let customerId = customerIds.get(plan.customer.email);

      if (customerId === undefined) {
        customerId = createRandomId();
        await customers.save(
          createCustomer({
            id: customerId,
            firstName: plan.customer.firstName,
            lastName: plan.customer.lastName,
            email: plan.customer.email,
            phone: plan.customer.phone,
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        );
        customerIds.set(plan.customer.email, customerId);
      }

      const passengerIds: string[] = [];

      for (const passenger of plan.passengers) {
        const passengerId = createRandomId();
        await passengers.save(
          createPassenger({
            id: passengerId,
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        );
        passengerIds.push(passengerId);
      }

      const voyage = voyageByCode(plan.voyageCode);
      const travelClass = travelClassCatalog.find(
        (item) => item.code === plan.travelClassCode,
      );

      if (travelClass === undefined) {
        throw new Error(`Unknown travel class ${plan.travelClassCode}.`);
      }

      const fare = multiplyMoney(
        createMoney(voyage.baseFareMinor),
        createFareMultiplier(travelClass.numerator, travelClass.denominator),
      );
      const reservation = createReservation({
        id: createRandomId(),
        confirmationCode: plan.confirmationCode,
        customerId,
        flightId: requiredId(flightIdByNumber, plan.flightNumber),
        travelClassId: requiredId(travelClassIds, plan.travelClassCode),
        status: plan.status,
        totalPrice: createMoney(fare.amountMinor * plan.passengers.length),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await reservations.save(reservation);

      for (const [index, passenger] of plan.passengers.entries()) {
        const passengerId = passengerIds[index];

        if (passengerId === undefined) {
          throw new Error(
            `Missing passenger id for ${plan.confirmationCode} ${passenger.accommodationCode}.`,
          );
        }

        await reservations.savePassenger(
          createReservationPassenger({
            id: createRandomId(),
            reservationId: reservation.id,
            passengerId,
            flightAccommodationId: requiredId(
              accommodationIdByKey,
              `${plan.flightNumber}:${passenger.accommodationCode}`,
            ),
            fare,
          }),
        );
      }
    }

    const [
      travelClassCount,
      voyageCount,
      familyCount,
      vehicleCount,
      capacityCount,
      flightCount,
      accommodationCount,
      customerCount,
      passengerCount,
      reservationCount,
      reservationPassengerCount,
      dolly,
    ] = await Promise.all([
      prisma.travelClass.count(),
      prisma.voyage.count(),
      prisma.vehicleFamily.count(),
      prisma.vehicle.count(),
      prisma.vehicleFamilyTravelClass.count(),
      prisma.flight.count(),
      prisma.flightAccommodation.count(),
      prisma.customer.count(),
      prisma.passenger.count(),
      prisma.reservation.count(),
      prisma.reservationPassenger.count(),
      prisma.reservation.findUniqueOrThrow({
        where: { confirmationCode: "DLY-ARES" },
        include: {
          customer: true,
          travelClass: true,
          flight: { include: { voyage: true, vehicle: true } },
          passengers: {
            include: { passenger: true, accommodation: true },
          },
        },
      }),
    ]);
    const dollyPassengers = [...dolly.passengers].sort((left, right) =>
      left.accommodation.code.localeCompare(right.accommodation.code),
    );

    return {
      anchor,
      counts: {
        travelClasses: travelClassCount,
        voyages: voyageCount,
        vehicleFamilies: familyCount,
        vehicles: vehicleCount,
        familyCapacities: capacityCount,
        flights: flightCount,
        accommodations: accommodationCount,
        customers: customerCount,
        passengers: passengerCount,
        reservations: reservationCount,
        reservationPassengers: reservationPassengerCount,
      },
      skipped: schedule.skipped,
      dolly: {
        confirmationCode: dolly.confirmationCode,
        customerName: `${dolly.customer.firstName} ${dolly.customer.lastName}`,
        email: dolly.customer.email,
        flightNumber: dolly.flight.flightNumber,
        voyageCode: dolly.flight.voyage.code,
        voyageName: dolly.flight.voyage.name,
        vehicleCode: dolly.flight.vehicle.code,
        travelClassCode: dolly.travelClass.code,
        departureAt: dolly.flight.departureAt,
        status: dolly.status,
        totalPriceMinor: Number(dolly.totalPriceAmountMinor),
        accommodations: dollyPassengers.map(
          (passenger) => passenger.accommodation.code,
        ),
        passengers: dollyPassengers.map(
          (passenger) =>
            `${passenger.passenger.firstName} ${passenger.passenger.lastName}`,
        ),
      },
    };
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
  }
}

async function createInChunks<T>(
  rows: readonly T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  const chunkSize = 1000;

  for (let index = 0; index < rows.length; index += chunkSize) {
    await write(rows.slice(index, index + chunkSize));
  }
}

function requiredId(ids: ReadonlyMap<string, string>, key: string): string {
  const id = ids.get(key);

  if (id === undefined) {
    throw new Error(`Missing id for ${key}.`);
  }

  return id;
}
