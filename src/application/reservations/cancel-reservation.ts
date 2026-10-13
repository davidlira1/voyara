import { systemClock, type Clock } from "../clock.js";
import { ReservationStatus } from "../../domain/reservations/reservation-status.js";
import {
  CancellationNotAllowedError,
  InvalidReservationError,
  ReservationNotFoundError,
} from "../errors.js";
import type { ReservationCancellation } from "../ports/reservation-cancellation.js";
import {
  normalizeConfirmationCode,
  toReservationDetails,
  type ReservationDetails,
} from "./reservation-details.js";

const cancellableStatuses = new Set<string>([
  ReservationStatus.Held,
  ReservationStatus.Confirmed,
]);

export async function cancelReservation(
  confirmationCode: string,
  dependencies: {
    cancellations: ReservationCancellation;
    clock?: Clock;
  },
): Promise<ReservationDetails> {
  const code = normalizeConfirmationCode(confirmationCode);
  const asOf = readClock(dependencies.clock ?? systemClock);

  return dependencies.cancellations.transact(async (unit) => {
    const locked = await unit.lockByConfirmationCode(code);

    if (locked === null) {
      throw new ReservationNotFoundError(code);
    }

    if (locked.details.status === ReservationStatus.Cancelled) {
      return toReservationDetails(locked.details);
    }

    if (
      !cancellableStatuses.has(locked.details.status) ||
      locked.details.departureAt.getTime() <= asOf.getTime()
    ) {
      throw new CancellationNotAllowedError(code);
    }

    await unit.markCancelled(locked.id, asOf);

    return toReservationDetails({
      ...locked.details,
      status: ReservationStatus.Cancelled,
      updatedAt: asOf,
    });
  });
}

function readClock(clock: Clock): Date {
  const now = clock.now();

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new InvalidReservationError("Reference time must be a valid instant.");
  }

  return new Date(now.getTime());
}
