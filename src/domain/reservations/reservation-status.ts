import { DomainInvariantError } from "../shared/domain-error.js";

export const ReservationStatus = {
  Held: "HELD",
  Confirmed: "CONFIRMED",
  Cancelled: "CANCELLED",
  Completed: "COMPLETED",
} as const;

export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];

const reservationStatuses = new Set<string>(Object.values(ReservationStatus));

export function requireReservationStatus(value: string): ReservationStatus {
  if (!reservationStatuses.has(value)) {
    throw new DomainInvariantError(
      "Reservation status must be HELD, CONFIRMED, CANCELLED, or COMPLETED.",
    );
  }

  return value as ReservationStatus;
}
