import type { VehicleId } from "../../domain/shared/entity-id.js";
import type { Vehicle } from "../../domain/vehicles/vehicle.js";

export type VehicleRepository = {
  findById(id: VehicleId): Promise<Vehicle | null>;
  findByCode(code: string): Promise<Vehicle | null>;
  save(vehicle: Vehicle): Promise<void>;
};
