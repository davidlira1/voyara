import type { ReservationRepository } from "../../../../application/ports/reservation-repository.js";
import { assertAccommodationMatchesReservation } from "../../../../domain/reservations/accommodation-assignment.js";
import { PersistenceError } from "../../persistence-error.js";
import type { PrismaClient } from "../client.js";
import { flightAccommodationToDomain } from "../mappers/flight-mapper.js";
import {
  reservationPassengerToDomain,
  reservationPassengerToPersistence,
  reservationToDomain,
  reservationToPersistence,
} from "../mappers/reservation-mapper.js";

export function createPrismaReservationRepository(
  prisma: PrismaClient,
): ReservationRepository {
  return {
    async findById(id) {
      const record = await prisma.reservation.findUnique({ where: { id } });
      return record === null ? null : reservationToDomain(record);
    },

    async findByConfirmationCode(confirmationCode) {
      const record = await prisma.reservation.findUnique({
        where: { confirmationCode },
      });
      return record === null ? null : reservationToDomain(record);
    },

    async save(reservation) {
      const data = reservationToPersistence(reservation);
      const { id, ...updates } = data;

      await prisma.reservation.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },

    async findPassengers(reservationId) {
      const records = await prisma.reservationPassenger.findMany({
        where: { reservationId },
      });

      return records.map(reservationPassengerToDomain);
    },

    async savePassenger(reservationPassenger) {
      const reservationRecord = await prisma.reservation.findUnique({
        where: { id: reservationPassenger.reservationId },
      });
      const accommodationRecord = await prisma.flightAccommodation.findUnique({
        where: { id: reservationPassenger.flightAccommodationId },
      });

      if (reservationRecord === null) {
        throw new PersistenceError(
          "Reservation was not found for the passenger assignment.",
        );
      }

      if (accommodationRecord === null) {
        throw new PersistenceError(
          "Flight accommodation was not found for the passenger assignment.",
        );
      }

      const reservation = reservationToDomain(reservationRecord);
      const accommodation = flightAccommodationToDomain(accommodationRecord);
      assertAccommodationMatchesReservation(reservation, accommodation);

      const data = reservationPassengerToPersistence(
        reservationPassenger,
        reservation.flightId,
        reservation.travelClassId,
      );
      const { id, ...updates } = data;

      await prisma.reservationPassenger.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
