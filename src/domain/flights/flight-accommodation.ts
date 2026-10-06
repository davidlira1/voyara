import {
  createFlightAccommodationId,
  createFlightId,
  createTravelClassId,
  type FlightAccommodationId,
  type FlightId,
  type TravelClassId,
} from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";

export type FlightAccommodation = {
  readonly id: FlightAccommodationId;
  readonly flightId: FlightId;
  readonly travelClassId: TravelClassId;
  readonly code: string;
};

export type CreateFlightAccommodationInput = {
  readonly id: string;
  readonly flightId: string;
  readonly travelClassId: string;
  readonly code: string;
};

export function createFlightAccommodation(
  input: CreateFlightAccommodationInput,
): FlightAccommodation {
  return Object.freeze({
    id: createFlightAccommodationId(input.id),
    flightId: createFlightId(input.flightId),
    travelClassId: createTravelClassId(input.travelClassId),
    code: requireNonEmpty(input.code, "Flight accommodation code"),
  });
}
