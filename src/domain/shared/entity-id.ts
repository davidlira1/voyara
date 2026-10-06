import { DomainInvariantError } from "./domain-error.js";

/**
 * Brands a caller-supplied id. Identifier generation belongs outside the domain.
 * The supplied characters are preserved; a blank string is rejected.
 */
function requireEntityId(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainInvariantError(`${label} must be a non-empty string.`);
  }

  return value;
}

declare const voyageIdBrand: unique symbol;
export type VoyageId = string & { readonly [voyageIdBrand]: true };
export function createVoyageId(value: string): VoyageId {
  return requireEntityId(value, "Voyage id") as VoyageId;
}

declare const travelClassIdBrand: unique symbol;
export type TravelClassId = string & { readonly [travelClassIdBrand]: true };
export function createTravelClassId(value: string): TravelClassId {
  return requireEntityId(value, "Travel class id") as TravelClassId;
}

declare const vehicleFamilyIdBrand: unique symbol;
export type VehicleFamilyId = string & {
  readonly [vehicleFamilyIdBrand]: true;
};
export function createVehicleFamilyId(value: string): VehicleFamilyId {
  return requireEntityId(value, "Vehicle family id") as VehicleFamilyId;
}

declare const vehicleFamilyTravelClassIdBrand: unique symbol;
export type VehicleFamilyTravelClassId = string & {
  readonly [vehicleFamilyTravelClassIdBrand]: true;
};
export function createVehicleFamilyTravelClassId(
  value: string,
): VehicleFamilyTravelClassId {
  return requireEntityId(
    value,
    "Vehicle family travel class id",
  ) as VehicleFamilyTravelClassId;
}

declare const vehicleIdBrand: unique symbol;
export type VehicleId = string & { readonly [vehicleIdBrand]: true };
export function createVehicleId(value: string): VehicleId {
  return requireEntityId(value, "Vehicle id") as VehicleId;
}

declare const flightIdBrand: unique symbol;
export type FlightId = string & { readonly [flightIdBrand]: true };
export function createFlightId(value: string): FlightId {
  return requireEntityId(value, "Flight id") as FlightId;
}

declare const flightAccommodationIdBrand: unique symbol;
export type FlightAccommodationId = string & {
  readonly [flightAccommodationIdBrand]: true;
};
export function createFlightAccommodationId(
  value: string,
): FlightAccommodationId {
  return requireEntityId(
    value,
    "Flight accommodation id",
  ) as FlightAccommodationId;
}

declare const customerIdBrand: unique symbol;
export type CustomerId = string & { readonly [customerIdBrand]: true };
export function createCustomerId(value: string): CustomerId {
  return requireEntityId(value, "Customer id") as CustomerId;
}

declare const passengerIdBrand: unique symbol;
export type PassengerId = string & { readonly [passengerIdBrand]: true };
export function createPassengerId(value: string): PassengerId {
  return requireEntityId(value, "Passenger id") as PassengerId;
}

declare const reservationIdBrand: unique symbol;
export type ReservationId = string & { readonly [reservationIdBrand]: true };
export function createReservationId(value: string): ReservationId {
  return requireEntityId(value, "Reservation id") as ReservationId;
}

declare const reservationPassengerIdBrand: unique symbol;
export type ReservationPassengerId = string & {
  readonly [reservationPassengerIdBrand]: true;
};
export function createReservationPassengerId(
  value: string,
): ReservationPassengerId {
  return requireEntityId(
    value,
    "Reservation passenger id",
  ) as ReservationPassengerId;
}
