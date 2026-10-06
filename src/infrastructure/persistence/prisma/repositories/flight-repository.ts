import type { FlightRepository } from "../../../../application/ports/flight-repository.js";
import type { PrismaClient } from "../client.js";
import {
  flightAccommodationToDomain,
  flightAccommodationToPersistence,
  flightToDomain,
  flightToPersistence,
} from "../mappers/flight-mapper.js";

export function createPrismaFlightRepository(
  prisma: PrismaClient,
): FlightRepository {
  return {
    async findById(id) {
      const record = await prisma.flight.findUnique({ where: { id } });
      return record === null ? null : flightToDomain(record);
    },

    async findByFlightNumber(flightNumber) {
      const record = await prisma.flight.findUnique({
        where: { flightNumber },
      });
      return record === null ? null : flightToDomain(record);
    },

    async save(flight) {
      const data = flightToPersistence(flight);
      const { id, ...updates } = data;

      await prisma.flight.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },

    async findAccommodations(flightId) {
      const records = await prisma.flightAccommodation.findMany({
        where: { flightId },
      });

      return records.map(flightAccommodationToDomain);
    },

    async saveAccommodation(accommodation) {
      const data = flightAccommodationToPersistence(accommodation);
      const { id, ...updates } = data;

      await prisma.flightAccommodation.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
