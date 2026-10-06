import type { PassengerRepository } from "../../../../application/ports/passenger-repository.js";
import type { PrismaClient } from "../client.js";
import {
  passengerToDomain,
  passengerToPersistence,
} from "../mappers/passenger-mapper.js";

export function createPrismaPassengerRepository(
  prisma: PrismaClient,
): PassengerRepository {
  return {
    async findById(id) {
      const record = await prisma.passenger.findUnique({ where: { id } });
      return record === null ? null : passengerToDomain(record);
    },

    async save(passenger) {
      const data = passengerToPersistence(passenger);
      const { id, ...updates } = data;

      await prisma.passenger.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
