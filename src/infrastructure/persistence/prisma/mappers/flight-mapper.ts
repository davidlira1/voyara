import type {
  Flight as FlightRecord,
  FlightAccommodation as FlightAccommodationRecord,
} from "../../../../../generated/prisma/client.js";
import {
  createFlightAccommodation,
  type FlightAccommodation,
} from "../../../../domain/flights/flight-accommodation.js";
import { createFlight, type Flight } from "../../../../domain/flights/flight.js";

export function flightToDomain(record: FlightRecord): Flight {
  return createFlight({
    id: record.id,
    flightNumber: record.flightNumber,
    voyageId: record.voyageId,
    vehicleId: record.vehicleId,
    departureAt: record.departureAt,
    returnAt: record.returnAt,
    status: record.status,
  });
}

export function flightToPersistence(flight: Flight): {
  id: string;
  flightNumber: string;
  voyageId: string;
  vehicleId: string;
  departureAt: Date;
  returnAt: Date;
  status: Flight["status"];
} {
  return {
    id: flight.id,
    flightNumber: flight.flightNumber,
    voyageId: flight.voyageId,
    vehicleId: flight.vehicleId,
    departureAt: flight.departureAt,
    returnAt: flight.returnAt,
    status: flight.status,
  };
}

export function flightAccommodationToDomain(
  record: FlightAccommodationRecord,
): FlightAccommodation {
  return createFlightAccommodation({
    id: record.id,
    flightId: record.flightId,
    travelClassId: record.travelClassId,
    code: record.code,
  });
}

export function flightAccommodationToPersistence(
  accommodation: FlightAccommodation,
): {
  id: string;
  flightId: string;
  travelClassId: string;
  code: string;
} {
  return {
    id: accommodation.id,
    flightId: accommodation.flightId,
    travelClassId: accommodation.travelClassId,
    code: accommodation.code,
  };
}
