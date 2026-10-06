import {
  createVehicleFamilyId,
  createVehicleId,
  type VehicleFamilyId,
  type VehicleId,
} from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import {
  requireVehicleStatus,
  type VehicleStatus,
} from "./vehicle-status.js";

export type Vehicle = {
  readonly id: VehicleId;
  readonly code: string;
  readonly name: string;
  readonly vehicleFamilyId: VehicleFamilyId;
  readonly status: VehicleStatus;
};

export type CreateVehicleInput = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly vehicleFamilyId: string;
  readonly status: string;
};

export function createVehicle(input: CreateVehicleInput): Vehicle {
  return Object.freeze({
    id: createVehicleId(input.id),
    code: requireNonEmpty(input.code, "Vehicle code"),
    name: requireNonEmpty(input.name, "Vehicle name"),
    vehicleFamilyId: createVehicleFamilyId(input.vehicleFamilyId),
    status: requireVehicleStatus(input.status),
  });
}
