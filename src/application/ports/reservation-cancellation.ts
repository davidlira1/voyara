import type { ReservationFacts } from "./reservation-query-repository.js";

export type LockedReservation = {
  readonly id: string;
  readonly details: ReservationFacts;
};

export type ReservationCancellationUnit = {
  lockByConfirmationCode(
    confirmationCode: string,
  ): Promise<LockedReservation | null>;
  markCancelled(id: string, updatedAt: Date): Promise<void>;
};

export type ReservationCancellation = {
  transact<T>(
    work: (unit: ReservationCancellationUnit) => Promise<T>,
  ): Promise<T>;
};
