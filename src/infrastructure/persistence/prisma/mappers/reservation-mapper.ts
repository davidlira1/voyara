import type {
  Reservation as ReservationRecord,
  ReservationPassenger as ReservationPassengerRecord,
} from "../../../../../generated/prisma/client.js";
import { createReservationPassenger } from "../../../../domain/reservations/reservation-passenger.js";
import type { ReservationPassenger } from "../../../../domain/reservations/reservation-passenger.js";
import {
  createReservation,
  type Reservation,
} from "../../../../domain/reservations/reservation.js";
import { moneyToDomain, moneyToPersistence } from "./money-mapper.js";

export function reservationToDomain(record: ReservationRecord): Reservation {
  return createReservation({
    id: record.id,
    confirmationCode: record.confirmationCode,
    customerId: record.customerId,
    flightId: record.flightId,
    travelClassId: record.travelClassId,
    status: record.status,
    totalPrice: moneyToDomain(
      record.totalPriceAmountMinor,
      record.totalPriceCurrency,
    ),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function reservationToPersistence(reservation: Reservation): {
  id: string;
  confirmationCode: string;
  customerId: string;
  flightId: string;
  travelClassId: string;
  status: Reservation["status"];
  totalPriceAmountMinor: bigint;
  totalPriceCurrency: string;
  createdAt: Date;
  updatedAt: Date;
} {
  const totalPrice = moneyToPersistence(reservation.totalPrice);

  return {
    id: reservation.id,
    confirmationCode: reservation.confirmationCode,
    customerId: reservation.customerId,
    flightId: reservation.flightId,
    travelClassId: reservation.travelClassId,
    status: reservation.status,
    totalPriceAmountMinor: totalPrice.amountMinor,
    totalPriceCurrency: totalPrice.currency,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

export function reservationPassengerToDomain(
  record: ReservationPassengerRecord,
): ReservationPassenger {
  return createReservationPassenger({
    id: record.id,
    reservationId: record.reservationId,
    passengerId: record.passengerId,
    flightAccommodationId: record.flightAccommodationId,
    fare: moneyToDomain(record.fareAmountMinor, record.fareCurrency),
  });
}

export function reservationPassengerToPersistence(
  reservationPassenger: ReservationPassenger,
  flightId: string,
  travelClassId: string,
): {
  id: string;
  reservationId: string;
  passengerId: string;
  flightAccommodationId: string;
  flightId: string;
  travelClassId: string;
  fareAmountMinor: bigint;
  fareCurrency: string;
} {
  const fare = moneyToPersistence(reservationPassenger.fare);

  return {
    id: reservationPassenger.id,
    reservationId: reservationPassenger.reservationId,
    passengerId: reservationPassenger.passengerId,
    flightAccommodationId: reservationPassenger.flightAccommodationId,
    flightId,
    travelClassId,
    fareAmountMinor: fare.amountMinor,
    fareCurrency: fare.currency,
  };
}
