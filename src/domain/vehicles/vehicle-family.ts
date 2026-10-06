import {
  createVehicleFamilyId,
  type VehicleFamilyId,
} from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";

export type VehicleFamily = {
  readonly id: VehicleFamilyId;
  readonly code: string;
  readonly name: string;
};

export type CreateVehicleFamilyInput = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
};

export function createVehicleFamily(
  input: CreateVehicleFamilyInput,
): VehicleFamily {
  return Object.freeze({
    id: createVehicleFamilyId(input.id),
    code: requireNonEmpty(input.code, "Vehicle family code"),
    name: requireNonEmpty(input.name, "Vehicle family name"),
  });
}
