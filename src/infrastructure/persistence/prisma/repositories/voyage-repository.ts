import type { VoyageRepository } from "../../../../application/ports/voyage-repository.js";
import type { PrismaClient } from "../client.js";
import {
  voyageToDomain,
  voyageToPersistence,
} from "../mappers/voyage-mapper.js";

export function createPrismaVoyageRepository(
  prisma: PrismaClient,
): VoyageRepository {
  return {
    async findById(id) {
      const record = await prisma.voyage.findUnique({ where: { id } });
      return record === null ? null : voyageToDomain(record);
    },

    async findByCode(code) {
      const record = await prisma.voyage.findUnique({ where: { code } });
      return record === null ? null : voyageToDomain(record);
    },

    async save(voyage) {
      const data = voyageToPersistence(voyage);
      const { id, ...updates } = data;

      await prisma.voyage.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
