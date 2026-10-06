import {
  createTravelClassId,
  createVehicleFamilyId,
  createVehicleFamilyTravelClassId,
  type TravelClassId,
  type VehicleFamilyId,
  type VehicleFamilyTravelClassId,
} from "../shared/entity-id.js";
import { requirePositiveInteger } from "../shared/numbers.js";

export type VehicleFamilyTravelClass = {
  readonly id: VehicleFamilyTravelClassId;
  readonly vehicleFamilyId: VehicleFamilyId;
  readonly travelClassId: TravelClassId;
  readonly capacity: number;
};

export type CreateVehicleFamilyTravelClassInput = {
  readonly id: string;
  readonly vehicleFamilyId: string;
  readonly travelClassId: string;
  readonly capacity: number;
};

export function createVehicleFamilyTravelClass(
  input: CreateVehicleFamilyTravelClassInput,
): VehicleFamilyTravelClass {
  return Object.freeze({
    id: createVehicleFamilyTravelClassId(input.id),
    vehicleFamilyId: createVehicleFamilyId(input.vehicleFamilyId),
    travelClassId: createTravelClassId(input.travelClassId),
    capacity: requirePositiveInteger(
      input.capacity,
      "Vehicle family travel class capacity",
    ),
  });
}
