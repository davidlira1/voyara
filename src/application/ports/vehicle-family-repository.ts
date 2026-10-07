import type {
  VehicleFamilyId,
} from "../../domain/shared/entity-id.js";
import type { VehicleFamily } from "../../domain/vehicles/vehicle-family.js";
import type { VehicleFamilyTravelClass } from "../../domain/vehicles/vehicle-family-travel-class.js";

export type VehicleFamilyRepository = {
  findById(id: VehicleFamilyId): Promise<VehicleFamily | null>;
  findByCode(code: string): Promise<VehicleFamily | null>;
  save(family: VehicleFamily): Promise<void>;
  findTravelClasses(
    vehicleFamilyId: VehicleFamilyId,
  ): Promise<readonly VehicleFamilyTravelClass[]>;
  saveTravelClass(travelClass: VehicleFamilyTravelClass): Promise<void>;
};
