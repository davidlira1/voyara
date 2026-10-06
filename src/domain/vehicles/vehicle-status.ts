import { DomainInvariantError } from "../shared/domain-error.js";

export const VehicleStatus = {
  Active: "ACTIVE",
  Maintenance: "MAINTENANCE",
  Retired: "RETIRED",
} as const;

export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

const vehicleStatuses = new Set<string>(Object.values(VehicleStatus));

export function requireVehicleStatus(value: string): VehicleStatus {
  if (!vehicleStatuses.has(value)) {
    throw new DomainInvariantError(
      "Vehicle status must be ACTIVE, MAINTENANCE, or RETIRED.",
    );
  }

  return value as VehicleStatus;
}
