import {
  createCustomerId,
  createFlightId,
  createReservationId,
  createTravelClassId,
  type CustomerId,
  type FlightId,
  type ReservationId,
  type TravelClassId,
} from "../shared/entity-id.js";
import { requireMoney, type Money } from "../shared/money.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import { requireInstant } from "../shared/time.js";
import {
  requireReservationStatus,
  type ReservationStatus,
} from "./reservation-status.js";

export type Reservation = {
  readonly id: ReservationId;
  readonly confirmationCode: string;
  readonly customerId: CustomerId;
  readonly flightId: FlightId;
  readonly travelClassId: TravelClassId;
  readonly status: ReservationStatus;
  readonly totalPrice: Money;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateReservationInput = {
  readonly id: string;
  readonly confirmationCode: string;
  readonly customerId: string;
  readonly flightId: string;
  readonly travelClassId: string;
  readonly status: string;
  readonly totalPrice: Money;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createReservation(input: CreateReservationInput): Reservation {
  return Object.freeze({
    id: createReservationId(input.id),
    confirmationCode: requireNonEmpty(
      input.confirmationCode,
      "Reservation confirmation code",
    ),
    customerId: createCustomerId(input.customerId),
    flightId: createFlightId(input.flightId),
    travelClassId: createTravelClassId(input.travelClassId),
    status: requireReservationStatus(input.status),
    totalPrice: requireMoney(input.totalPrice),
    createdAt: requireInstant(input.createdAt, "Reservation created at"),
    updatedAt: requireInstant(input.updatedAt, "Reservation updated at"),
  });
}
