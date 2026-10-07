import type { ReservationPassenger } from "../../domain/reservations/reservation-passenger.js";
import type { Reservation } from "../../domain/reservations/reservation.js";
import type { ReservationId } from "../../domain/shared/entity-id.js";

export type ReservationRepository = {
  findById(id: ReservationId): Promise<Reservation | null>;
  findByConfirmationCode(confirmationCode: string): Promise<Reservation | null>;
  save(reservation: Reservation): Promise<void>;
  findPassengers(
    reservationId: ReservationId,
  ): Promise<readonly ReservationPassenger[]>;
  savePassenger(reservationPassenger: ReservationPassenger): Promise<void>;
};
