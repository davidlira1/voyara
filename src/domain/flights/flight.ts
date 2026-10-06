import { DomainInvariantError } from "../shared/domain-error.js";
import {
  createFlightId,
  createVehicleId,
  createVoyageId,
  type FlightId,
  type VehicleId,
  type VoyageId,
} from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import { requireInstant } from "../shared/time.js";
import { requireFlightStatus, type FlightStatus } from "./flight-status.js";

export type Flight = {
  readonly id: FlightId;
  readonly flightNumber: string;
  readonly voyageId: VoyageId;
  readonly vehicleId: VehicleId;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly status: FlightStatus;
};

export type CreateFlightInput = {
  readonly id: string;
  readonly flightNumber: string;
  readonly voyageId: string;
  readonly vehicleId: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly status: string;
};

export function createFlight(input: CreateFlightInput): Flight {
  const departureAt = requireInstant(input.departureAt, "Flight departure");
  const returnAt = requireInstant(input.returnAt, "Flight return");

  if (returnAt.getTime() <= departureAt.getTime()) {
    throw new DomainInvariantError(
      "Flight return time must be after departure time.",
    );
  }

  return Object.freeze({
    id: createFlightId(input.id),
    flightNumber: requireNonEmpty(input.flightNumber, "Flight number"),
    voyageId: createVoyageId(input.voyageId),
    vehicleId: createVehicleId(input.vehicleId),
    departureAt,
    returnAt,
    status: requireFlightStatus(input.status),
  });
}
