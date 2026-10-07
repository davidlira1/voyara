import type { Vehicle as VehicleRecord } from "../../../../../generated/prisma/client.js";
import { createVehicle, type Vehicle } from "../../../../domain/vehicles/vehicle.js";

export function vehicleToDomain(record: VehicleRecord): Vehicle {
  return createVehicle({
    id: record.id,
    code: record.code,
    name: record.name,
    vehicleFamilyId: record.vehicleFamilyId,
    status: record.status,
  });
}

export function vehicleToPersistence(vehicle: Vehicle): {
  id: string;
  code: string;
  name: string;
  vehicleFamilyId: string;
  status: Vehicle["status"];
} {
  return {
    id: vehicle.id,
    code: vehicle.code,
    name: vehicle.name,
    vehicleFamilyId: vehicle.vehicleFamilyId,
    status: vehicle.status,
  };
}
