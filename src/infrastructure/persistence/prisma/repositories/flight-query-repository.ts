import { Prisma } from "../../../../../generated/prisma/client.js";
import type {
  FlightAvailabilityFacts,
  FlightClassFacts,
  FlightFacts,
  FlightQueryRepository,
} from "../../../../application/ports/flight-query-repository.js";
import type { FlightSearchQuery } from "../../../../application/flights/flight-search-criteria.js";
import { moneyToDomain } from "../mappers/money-mapper.js";
import type { PrismaClient } from "../client.js";

const occupyingStatuses = Prisma.sql`('HELD', 'CONFIRMED', 'COMPLETED')`;

type FlightRow = {
  flight_number: string;
  departure_at: Date;
  return_at: Date;
  status: string;
  voyage_code: string;
  voyage_name: string;
  base_fare_amount_minor: bigint;
  base_fare_currency: string;
  vehicle_code: string;
  vehicle_name: string;
  family_code: string;
  family_name: string;
};

type ClassRow = {
  flight_number: string;
  code: string;
  name: string;
  numerator: number;
  denominator: number;
  total_count: number;
  available_count: number;
};

type AvailableSeatRow = {
  travel_class_code: string;
  code: string;
};

export function createPrismaFlightQueryRepository(
  prisma: PrismaClient,
): FlightQueryRepository {
  return {
    async search(criteria) {
      const flights = await prisma.$queryRaw<FlightRow[]>`
        SELECT
          f.flight_number,
          f.departure_at,
          f.return_at,
          f.status::text AS status,
          v.code AS voyage_code,
          v.name AS voyage_name,
          v.base_fare_amount_minor,
          v.base_fare_currency,
          ve.code AS vehicle_code,
          ve.name AS vehicle_name,
          fam.code AS family_code,
          fam.name AS family_name
        FROM flights f
        JOIN voyages v ON v.id = f.voyage_id
        JOIN vehicles ve ON ve.id = f.vehicle_id
        JOIN vehicle_families fam ON fam.id = ve.vehicle_family_id
        WHERE ${searchFilters(criteria)}
        ORDER BY f.departure_at ASC, f.flight_number ASC
        LIMIT ${criteria.limit}
      `;

      return attachClasses(prisma, flights);
    },

    async findByFlightNumber(flightNumber) {
      const flights = await loadFlights(
        prisma,
        Prisma.sql`f.flight_number = ${flightNumber}`,
      );
      const flight = flights[0];

      if (flight === undefined) {
        return null;
      }

      const [facts] = await attachClasses(prisma, [flight]);
      return facts ?? null;
    },

    async findAvailability(flightNumber) {
      const flight = await this.findByFlightNumber(flightNumber);

      if (flight === null) {
        return null;
      }

      const seats = await prisma.$queryRaw<AvailableSeatRow[]>`
        SELECT tc.code AS travel_class_code, fa.code
        FROM flight_accommodations fa
        JOIN flights f ON f.id = fa.flight_id
        JOIN travel_classes tc ON tc.id = fa.travel_class_id
        WHERE f.flight_number = ${flightNumber}
          AND NOT EXISTS (
            SELECT 1
            FROM reservation_passengers rp
            JOIN reservations r ON r.id = rp.reservation_id
            WHERE rp.flight_accommodation_id = fa.id
              AND r.status::text IN ${occupyingStatuses}
          )
        ORDER BY tc.code ASC, fa.code ASC
      `;
      const codesByClass = new Map<string, string[]>();

      for (const seat of seats) {
        const codes = codesByClass.get(seat.travel_class_code) ?? [];
        codes.push(seat.code);
        codesByClass.set(seat.travel_class_code, codes);
      }

      return {
        flightNumber: flight.flightNumber,
        baseFareAmountMinor: flight.baseFareAmountMinor,
        classes: flight.classes.map((travelClass) => ({
          ...travelClass,
          availableAccommodationCodes:
            codesByClass.get(travelClass.code) ?? [],
        })),
      } satisfies FlightAvailabilityFacts;
    },
  };
}

function searchFilters(criteria: FlightSearchQuery): Prisma.Sql {
  const filters = [
    Prisma.sql`f.status::text IN ('SCHEDULED', 'DELAYED')`,
    Prisma.sql`f.departure_at > ${criteria.asOf}`,
  ];

  if (criteria.voyageCode !== undefined) {
    filters.push(Prisma.sql`v.code = ${criteria.voyageCode}`);
  }

  if (criteria.departureFrom !== undefined) {
    filters.push(Prisma.sql`f.departure_at >= ${criteria.departureFrom}`);
  }

  if (criteria.departureTo !== undefined) {
    filters.push(Prisma.sql`f.departure_at <= ${criteria.departureTo}`);
  }

  if (
    criteria.travelClassCode !== undefined &&
    criteria.passengerCount === undefined
  ) {
    filters.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM flight_accommodations fa
        JOIN travel_classes tc ON tc.id = fa.travel_class_id
        WHERE fa.flight_id = f.id
          AND tc.code = ${criteria.travelClassCode}
      )
    `);
  }

  if (criteria.passengerCount !== undefined) {
    const classFilter =
      criteria.travelClassCode === undefined
        ? Prisma.empty
        : Prisma.sql`AND tc.code = ${criteria.travelClassCode}`;
    filters.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM flight_accommodations fa
        JOIN travel_classes tc ON tc.id = fa.travel_class_id
        LEFT JOIN LATERAL (
          SELECT rp.id
          FROM reservation_passengers rp
          JOIN reservations r ON r.id = rp.reservation_id
          WHERE rp.flight_accommodation_id = fa.id
            AND r.status::text IN ${occupyingStatuses}
          LIMIT 1
        ) occupied ON TRUE
        WHERE fa.flight_id = f.id
          ${classFilter}
        GROUP BY tc.id
        HAVING COUNT(*) FILTER (WHERE occupied.id IS NULL) >= ${criteria.passengerCount}
      )
    `);
  }

  return Prisma.join(filters, " AND ");
}

async function loadFlights(
  prisma: PrismaClient,
  where: Prisma.Sql,
): Promise<FlightRow[]> {
  return prisma.$queryRaw<FlightRow[]>`
    SELECT
      f.flight_number,
      f.departure_at,
      f.return_at,
      f.status::text AS status,
      v.code AS voyage_code,
      v.name AS voyage_name,
      v.base_fare_amount_minor,
      v.base_fare_currency,
      ve.code AS vehicle_code,
      ve.name AS vehicle_name,
      fam.code AS family_code,
      fam.name AS family_name
    FROM flights f
    JOIN voyages v ON v.id = f.voyage_id
    JOIN vehicles ve ON ve.id = f.vehicle_id
    JOIN vehicle_families fam ON fam.id = ve.vehicle_family_id
    WHERE ${where}
  `;
}

async function attachClasses(
  prisma: PrismaClient,
  flights: readonly FlightRow[],
): Promise<FlightFacts[]> {
  if (flights.length === 0) {
    return [];
  }

  const flightNumbers = flights.map((flight) => flight.flight_number);
  const classes = await prisma.$queryRaw<ClassRow[]>`
    SELECT
      f.flight_number,
      tc.code,
      tc.name,
      tc.fare_multiplier_numerator AS numerator,
      tc.fare_multiplier_denominator AS denominator,
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE occupied.id IS NULL)::int AS available_count
    FROM flight_accommodations fa
    JOIN flights f ON f.id = fa.flight_id
    JOIN travel_classes tc ON tc.id = fa.travel_class_id
    LEFT JOIN LATERAL (
      SELECT rp.id
      FROM reservation_passengers rp
      JOIN reservations r ON r.id = rp.reservation_id
      WHERE rp.flight_accommodation_id = fa.id
        AND r.status::text IN ${occupyingStatuses}
      LIMIT 1
    ) occupied ON TRUE
    WHERE f.flight_number IN (${Prisma.join(flightNumbers)})
    GROUP BY
      f.flight_number,
      tc.code,
      tc.name,
      tc.fare_multiplier_numerator,
      tc.fare_multiplier_denominator
    ORDER BY tc.code ASC
  `;
  const classesByFlight = new Map<string, FlightClassFacts[]>();

  for (const row of classes) {
    const list = classesByFlight.get(row.flight_number) ?? [];
    list.push({
      code: row.code,
      name: row.name,
      numerator: row.numerator,
      denominator: row.denominator,
      totalCount: Number(row.total_count),
      availableCount: Number(row.available_count),
    });
    classesByFlight.set(row.flight_number, list);
  }

  return flights.map((flight) => {
    const baseFare = moneyToDomain(
      flight.base_fare_amount_minor,
      flight.base_fare_currency.trim(),
    );

    return {
      flightNumber: flight.flight_number,
      departureAt: flight.departure_at,
      returnAt: flight.return_at,
      status: flight.status,
      voyageCode: flight.voyage_code,
      voyageName: flight.voyage_name,
      baseFareAmountMinor: baseFare.amountMinor,
      spacecraft: {
        code: flight.vehicle_code,
        name: flight.vehicle_name,
        familyCode: flight.family_code,
        familyName: flight.family_name,
      },
      classes: classesByFlight.get(flight.flight_number) ?? [],
    };
  });
}
