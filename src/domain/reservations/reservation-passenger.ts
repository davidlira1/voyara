import {
  createFlightAccommodationId,
  createPassengerId,
  createReservationId,
  createReservationPassengerId,
  type FlightAccommodationId,
  type PassengerId,
  type ReservationId,
  type ReservationPassengerId,
} from "../shared/entity-id.js";
import { requireMoney, type Money } from "../shared/money.js";

export type ReservationPassenger = {
  readonly id: ReservationPassengerId;
  readonly reservationId: ReservationId;
  readonly passengerId: PassengerId;
  readonly flightAccommodationId: FlightAccommodationId;
  readonly fare: Money;
};

export type CreateReservationPassengerInput = {
  readonly id: string;
  readonly reservationId: string;
  readonly passengerId: string;
  readonly flightAccommodationId: string;
  readonly fare: Money;
};

export function createReservationPassenger(
  input: CreateReservationPassengerInput,
): ReservationPassenger {
  return Object.freeze({
    id: createReservationPassengerId(input.id),
    reservationId: createReservationId(input.reservationId),
    passengerId: createPassengerId(input.passengerId),
    flightAccommodationId: createFlightAccommodationId(
      input.flightAccommodationId,
    ),
    fare: requireMoney(input.fare),
  });
}
