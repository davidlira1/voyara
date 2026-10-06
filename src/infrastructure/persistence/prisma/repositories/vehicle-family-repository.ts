import type { VehicleFamilyRepository } from "../../../../application/ports/vehicle-family-repository.js";
import type { PrismaClient } from "../client.js";
import {
  vehicleFamilyToDomain,
  vehicleFamilyToPersistence,
  vehicleFamilyTravelClassToDomain,
  vehicleFamilyTravelClassToPersistence,
} from "../mappers/vehicle-family-mapper.js";

export function createPrismaVehicleFamilyRepository(
  prisma: PrismaClient,
): VehicleFamilyRepository {
  return {
    async findById(id) {
      const record = await prisma.vehicleFamily.findUnique({ where: { id } });
      return record === null ? null : vehicleFamilyToDomain(record);
    },

    async findByCode(code) {
      const record = await prisma.vehicleFamily.findUnique({ where: { code } });
      return record === null ? null : vehicleFamilyToDomain(record);
    },

    async save(family) {
      const data = vehicleFamilyToPersistence(family);
      const { id, ...updates } = data;

      await prisma.vehicleFamily.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },

    async findTravelClasses(vehicleFamilyId) {
      const records = await prisma.vehicleFamilyTravelClass.findMany({
        where: { vehicleFamilyId },
      });

      return records.map(vehicleFamilyTravelClassToDomain);
    },

    async saveTravelClass(travelClass) {
      const data = vehicleFamilyTravelClassToPersistence(travelClass);
      const { id, ...updates } = data;

      await prisma.vehicleFamilyTravelClass.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
