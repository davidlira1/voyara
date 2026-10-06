import type { VehicleRepository } from "../../../../application/ports/vehicle-repository.js";
import type { PrismaClient } from "../client.js";
import {
  vehicleToDomain,
  vehicleToPersistence,
} from "../mappers/vehicle-mapper.js";

export function createPrismaVehicleRepository(
  prisma: PrismaClient,
): VehicleRepository {
  return {
    async findById(id) {
      const record = await prisma.vehicle.findUnique({ where: { id } });
      return record === null ? null : vehicleToDomain(record);
    },

    async findByCode(code) {
      const record = await prisma.vehicle.findUnique({ where: { code } });
      return record === null ? null : vehicleToDomain(record);
    },

    async save(vehicle) {
      const data = vehicleToPersistence(vehicle);
      const { id, ...updates } = data;

      await prisma.vehicle.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
