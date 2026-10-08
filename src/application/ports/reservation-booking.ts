import type { Customer } from "../../domain/customers/customer.js";
import type { Passenger } from "../../domain/passengers/passenger.js";
import type { ReservationPassenger } from "../../domain/reservations/reservation-passenger.js";
import type { Reservation } from "../../domain/reservations/reservation.js";

export type BookingFlightClass = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly numerator: number;
  readonly denominator: number;
};

export type BookingFlight = {
  readonly id: string;
  readonly flightNumber: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly status: string;
  readonly voyageCode: string;
  readonly voyageName: string;
  readonly baseFareAmountMinor: number;
  readonly classes: readonly BookingFlightClass[];
};

export type LockedAccommodation = {
  readonly id: string;
  readonly code: string;
};

export type BookingPersistInput = {
  readonly customer: Customer;
  readonly passengers: readonly Passenger[];
  readonly reservation: Reservation;
  readonly assignments: readonly ReservationPassenger[];
};

export type BookingUnitOfWork = {
  findFlight(flightNumber: string): Promise<BookingFlight | null>;
  lockAccommodations(input: {
    flightId: string;
    travelClassId: string;
    count: number;
  }): Promise<readonly LockedAccommodation[]>;
  persist(booking: BookingPersistInput): Promise<{ confirmationCode: string }>;
};

export type ReservationBooking = {
  transact<T>(work: (unit: BookingUnitOfWork) => Promise<T>): Promise<T>;
};
