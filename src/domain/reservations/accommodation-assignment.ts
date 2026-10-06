import type { FlightAccommodation } from "../flights/flight-accommodation.js";
import { DomainInvariantError } from "../shared/domain-error.js";
import type { Reservation } from "./reservation.js";

/**
 * Checks flight and travel class when both records are already loaded.
 * Does not decide whether the accommodation is free.
 */
export function assertAccommodationMatchesReservation(
  reservation: Reservation,
  accommodation: FlightAccommodation,
): void {
  if (accommodation.flightId !== reservation.flightId) {
    throw new DomainInvariantError(
      "Assigned accommodation must belong to the reservation's flight.",
    );
  }

  if (accommodation.travelClassId !== reservation.travelClassId) {
    throw new DomainInvariantError(
      "Assigned accommodation must match the reservation's travel class.",
    );
  }
}
