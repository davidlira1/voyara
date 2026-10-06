import type { TravelClassRepository } from "../../../../application/ports/travel-class-repository.js";
import type { PrismaClient } from "../client.js";
import {
  travelClassToDomain,
  travelClassToPersistence,
} from "../mappers/travel-class-mapper.js";

export function createPrismaTravelClassRepository(
  prisma: PrismaClient,
): TravelClassRepository {
  return {
    async findById(id) {
      const record = await prisma.travelClass.findUnique({ where: { id } });
      return record === null ? null : travelClassToDomain(record);
    },

    async findByCode(code) {
      const record = await prisma.travelClass.findUnique({ where: { code } });
      return record === null ? null : travelClassToDomain(record);
    },

    async save(travelClass) {
      const data = travelClassToPersistence(travelClass);
      const { id, ...updates } = data;

      await prisma.travelClass.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
