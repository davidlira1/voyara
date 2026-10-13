import type { Prisma } from "../../../../generated/prisma/client.js";
import type {
  ReservationFacts,
  ReservationPassengerFacts,
} from "../../../application/ports/reservation-query-repository.js";
import { moneyToDomain } from "./mappers/money-mapper.js";
import type { PrismaClient } from "./client.js";

type QueryClient = PrismaClient | Prisma.TransactionClient;

type HeaderRow = {
  id: string;
  confirmation_code: string;
  status: string;
  total_price_amount_minor: bigint;
  total_price_currency: string;
  created_at: Date;
  updated_at: Date;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  flight_number: string;
  departure_at: Date;
  return_at: Date;
  flight_status: string;
  voyage_code: string;
  voyage_name: string;
  travel_class_code: string;
  travel_class_name: string;
};

type PassengerRow = {
  first_name: string;
  last_name: string;
  accommodation_code: string;
  fare_amount_minor: bigint;
  fare_currency: string;
};

export async function loadReservationSnapshot(
  client: QueryClient,
  confirmationCode: string,
  lock: boolean,
): Promise<{ id: string; details: ReservationFacts } | null> {
  if (!lock) {
    return loadConsistentReservation(client, confirmationCode);
  }

  const headers = await client.$queryRaw<HeaderRow[]>`
    SELECT
      r.id,
      r.confirmation_code,
      r.status::text AS status,
      r.total_price_amount_minor,
      r.total_price_currency,
      r.created_at,
      r.updated_at,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      f.flight_number,
      f.departure_at,
      f.return_at,
      f.status::text AS flight_status,
      v.code AS voyage_code,
      v.name AS voyage_name,
      tc.code AS travel_class_code,
      tc.name AS travel_class_name
    FROM reservations r
    JOIN customers c ON c.id = r.customer_id
    JOIN flights f ON f.id = r.flight_id
    JOIN voyages v ON v.id = f.voyage_id
    JOIN travel_classes tc ON tc.id = r.travel_class_id
    WHERE r.confirmation_code = ${confirmationCode}
    FOR UPDATE OF r
  `;
  const header = headers[0];

  if (header === undefined) {
    return null;
  }

  const passengers = await client.$queryRaw<PassengerRow[]>`
    SELECT
      p.first_name,
      p.last_name,
      fa.code AS accommodation_code,
      rp.fare_amount_minor,
      rp.fare_currency
    FROM reservation_passengers rp
    JOIN passengers p ON p.id = rp.passenger_id
    JOIN flight_accommodations fa ON fa.id = rp.flight_accommodation_id
    WHERE rp.reservation_id = ${header.id}::uuid
    ORDER BY fa.code ASC
  `;

  return {
    id: header.id,
    details: toFacts(header, passengers),
  };
}

async function loadConsistentReservation(
  client: QueryClient,
  confirmationCode: string,
): Promise<{ id: string; details: ReservationFacts } | null> {
  const rows = await client.$queryRaw<ConsistentReservationRow[]>`
    SELECT
      r.id,
      r.confirmation_code,
      r.status::text AS status,
      r.total_price_amount_minor,
      r.total_price_currency,
      r.created_at,
      r.updated_at,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      f.flight_number,
      f.departure_at,
      f.return_at,
      f.status::text AS flight_status,
      v.code AS voyage_code,
      v.name AS voyage_name,
      tc.code AS travel_class_code,
      tc.name AS travel_class_name,
      COALESCE(
        json_agg(
          json_build_object(
            'firstName', p.first_name,
            'lastName', p.last_name,
            'accommodationCode', fa.code,
            'fareAmountMinor', rp.fare_amount_minor::text,
            'fareCurrency', btrim(rp.fare_currency)
          )
          ORDER BY fa.code
        ) FILTER (WHERE rp.id IS NOT NULL),
        '[]'::json
      ) AS passengers
    FROM reservations r
    JOIN customers c ON c.id = r.customer_id
    JOIN flights f ON f.id = r.flight_id
    JOIN voyages v ON v.id = f.voyage_id
    JOIN travel_classes tc ON tc.id = r.travel_class_id
    LEFT JOIN reservation_passengers rp ON rp.reservation_id = r.id
    LEFT JOIN passengers p ON p.id = rp.passenger_id
    LEFT JOIN flight_accommodations fa ON fa.id = rp.flight_accommodation_id
    WHERE r.confirmation_code = ${confirmationCode}
    GROUP BY r.id, c.id, f.id, v.id, tc.id
  `;
  const row = rows[0];

  if (row === undefined) {
    return null;
  }

  return {
    id: row.id,
    details: toFacts(row, parseAggregatedPassengers(row.passengers)),
  };
}

type AggregatedPassenger = {
  firstName: string;
  lastName: string;
  accommodationCode: string;
  fareAmountMinor: string | number;
  fareCurrency: string;
};

type ConsistentReservationRow = HeaderRow & {
  passengers: AggregatedPassenger[] | string | null;
};

function parseAggregatedPassengers(
  passengers: AggregatedPassenger[] | string | null,
): PassengerRow[] {
  const parsed: AggregatedPassenger[] =
    typeof passengers === "string" ? JSON.parse(passengers) : (passengers ?? []);

  return parsed.map((passenger) => ({
    first_name: passenger.firstName,
    last_name: passenger.lastName,
    accommodation_code: passenger.accommodationCode,
    fare_amount_minor: BigInt(passenger.fareAmountMinor),
    fare_currency: passenger.fareCurrency,
  }));
}

function toFacts(
  header: HeaderRow,
  passengers: readonly PassengerRow[],
): ReservationFacts {
  const totalPrice = moneyToDomain(
    header.total_price_amount_minor,
    header.total_price_currency.trim(),
  );

  return {
    confirmationCode: header.confirmation_code,
    status: header.status,
    customerFirstName: header.customer_first_name,
    customerLastName: header.customer_last_name,
    customerEmail: header.customer_email,
    customerPhone: header.customer_phone.trim(),
    flightNumber: header.flight_number,
    departureAt: header.departure_at,
    returnAt: header.return_at,
    flightStatus: header.flight_status,
    voyageCode: header.voyage_code,
    voyageName: header.voyage_name,
    travelClassCode: header.travel_class_code,
    travelClassName: header.travel_class_name,
    passengers: passengers.map(toPassenger),
    totalPriceAmountMinor: totalPrice.amountMinor,
    createdAt: header.created_at,
    updatedAt: header.updated_at,
  };
}

function toPassenger(row: PassengerRow): ReservationPassengerFacts {
  const fare = moneyToDomain(row.fare_amount_minor, row.fare_currency.trim());

  return {
    firstName: row.first_name,
    lastName: row.last_name,
    accommodationCode: row.accommodation_code,
    fareAmountMinor: fare.amountMinor,
  };
}
