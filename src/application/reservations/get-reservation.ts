import { ReservationNotFoundError } from "../errors.js";
import type { ReservationQueryRepository } from "../ports/reservation-query-repository.js";
import {
  normalizeConfirmationCode,
  toReservationDetails,
  type ReservationDetails,
} from "./reservation-details.js";

export async function getReservation(
  confirmationCode: string,
  reservations: ReservationQueryRepository,
): Promise<ReservationDetails> {
  const code = normalizeConfirmationCode(confirmationCode);
  const facts = await reservations.findByConfirmationCode(code);

  if (facts === null) {
    throw new ReservationNotFoundError(code);
  }

  return toReservationDetails(facts);
}
