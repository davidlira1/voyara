import type { FlightAccommodation } from "../../domain/flights/flight-accommodation.js";
import type { Flight } from "../../domain/flights/flight.js";
import type { FlightId } from "../../domain/shared/entity-id.js";

export type FlightRepository = {
  findById(id: FlightId): Promise<Flight | null>;
  findByFlightNumber(flightNumber: string): Promise<Flight | null>;
  save(flight: Flight): Promise<void>;
  findAccommodations(
    flightId: FlightId,
  ): Promise<readonly FlightAccommodation[]>;
  saveAccommodation(accommodation: FlightAccommodation): Promise<void>;
};
