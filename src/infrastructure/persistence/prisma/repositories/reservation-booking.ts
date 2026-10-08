import { Prisma } from "../../../../../generated/prisma/client.js";
import { ApplicationError } from "../../../../application/errors.js";
import type {
  BookingFlight,
  BookingFlightClass,
  BookingUnitOfWork,
  LockedAccommodation,
  ReservationBooking,
} from "../../../../application/ports/reservation-booking.js";
import { PersistenceError } from "../../persistence-error.js";
import { customerToPersistence } from "../mappers/customer-mapper.js";
import { moneyToDomain } from "../mappers/money-mapper.js";
import { passengerToPersistence } from "../mappers/passenger-mapper.js";
import {
  reservationPassengerToPersistence,
  reservationToPersistence,
} from "../mappers/reservation-mapper.js";
import type { PrismaClient } from "../client.js";

const maxConfirmationAttempts = 5;
const occupyingStatuses = Prisma.sql`('HELD', 'CONFIRMED', 'COMPLETED')`;

export function createPrismaReservationBooking(
  prisma: PrismaClient,
): ReservationBooking {
  return {
    async transact(work) {
      for (let attempt = 0; attempt < maxConfirmationAttempts; attempt += 1) {
        try {
          return await prisma.$transaction((tx) => work(createUnit(tx)));
        } catch (error) {
          if (error instanceof ApplicationError) {
            throw error;
          }

          if (
            isConfirmationCodeConflict(error) &&
            attempt < maxConfirmationAttempts - 1
          ) {
            continue;
          }

          if (isConfirmationCodeConflict(error)) {
            throw new PersistenceError(
              "Could not allocate a confirmation code.",
            );
          }

          throw error;
        }
      }

      throw new PersistenceError("Could not allocate a confirmation code.");
    },
  };
}

function createUnit(tx: Prisma.TransactionClient): BookingUnitOfWork {
  return {
    async findFlight(flightNumber) {
      const flight = await tx.flight.findUnique({
        where: { flightNumber },
        include: { voyage: true },
      });

      if (flight === null) {
        return null;
      }

      const classes = await tx.$queryRaw<BookingFlightClass[]>`
        SELECT DISTINCT
          tc.id,
          tc.code,
          tc.name,
          tc.fare_multiplier_numerator AS numerator,
          tc.fare_multiplier_denominator AS denominator
        FROM flight_accommodations fa
        JOIN travel_classes tc ON tc.id = fa.travel_class_id
        WHERE fa.flight_id = ${flight.id}::uuid
        ORDER BY tc.code ASC
      `;

      const baseFare = moneyToDomain(
        flight.voyage.baseFareAmountMinor,
        flight.voyage.baseFareCurrency.trim(),
      );

      return {
        id: flight.id,
        flightNumber: flight.flightNumber,
        departureAt: new Date(flight.departureAt),
        returnAt: new Date(flight.returnAt),
        status: flight.status,
        voyageCode: flight.voyage.code,
        voyageName: flight.voyage.name,
        baseFareAmountMinor: baseFare.amountMinor,
        classes,
      } satisfies BookingFlight;
    },

    async lockAccommodations(input) {
      const rows = await tx.$queryRaw<LockedAccommodation[]>`
        SELECT fa.id, fa.code
        FROM flight_accommodations fa
        WHERE fa.flight_id = ${input.flightId}::uuid
          AND fa.travel_class_id = ${input.travelClassId}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM reservation_passengers rp
            JOIN reservations r ON r.id = rp.reservation_id
            WHERE rp.flight_accommodation_id = fa.id
              AND r.status::text IN ${occupyingStatuses}
          )
        ORDER BY fa.code ASC
        LIMIT ${input.count}
        FOR UPDATE OF fa SKIP LOCKED
      `;

      return rows;
    },

    async persist(booking) {
      await tx.customer.create({
        data: customerToPersistence(booking.customer),
      });

      for (const passenger of booking.passengers) {
        await tx.passenger.create({
          data: passengerToPersistence(passenger),
        });
      }

      await tx.reservation.create({
        data: reservationToPersistence(booking.reservation),
      });

      for (const assignment of booking.assignments) {
        await tx.reservationPassenger.create({
          data: reservationPassengerToPersistence(
            assignment,
            booking.reservation.flightId,
            booking.reservation.travelClassId,
          ),
        });
      }

      return { confirmationCode: booking.reservation.confirmationCode };
    },
  };
}

export function isConfirmationCodeConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const fields = uniqueTargetFields("meta" in error ? error.meta : undefined);

  return [message, ...fields].some(
    (field) =>
      field.includes("confirmationCode") ||
      field.includes("confirmation_code") ||
      field.includes("reservations_confirmation_code_key"),
  );
}

function uniqueTargetFields(meta: unknown): string[] {
  if (typeof meta !== "object" || meta === null) {
    return [];
  }

  const target = "target" in meta ? meta.target : undefined;
  const constraint = "constraint" in meta ? meta.constraint : undefined;
  const fields = [
    ...(Array.isArray(target) ? target : []),
    ...(typeof target === "string" ? [target] : []),
    ...(typeof constraint === "string" ? [constraint] : []),
  ];

  return fields.filter((field): field is string => typeof field === "string");
}
