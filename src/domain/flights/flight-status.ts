import { DomainInvariantError } from "../shared/domain-error.js";

export const FlightStatus = {
  Scheduled: "SCHEDULED",
  Boarding: "BOARDING",
  Departed: "DEPARTED",
  InFlight: "IN_FLIGHT",
  Returning: "RETURNING",
  Arrived: "ARRIVED",
  Delayed: "DELAYED",
  Cancelled: "CANCELLED",
} as const;

export type FlightStatus = (typeof FlightStatus)[keyof typeof FlightStatus];

const flightStatuses = new Set<string>(Object.values(FlightStatus));

export function requireFlightStatus(value: string): FlightStatus {
  if (!flightStatuses.has(value)) {
    throw new DomainInvariantError(
      "Flight status must be SCHEDULED, BOARDING, DEPARTED, IN_FLIGHT, RETURNING, ARRIVED, DELAYED, or CANCELLED.",
    );
  }

  return value as FlightStatus;
}
