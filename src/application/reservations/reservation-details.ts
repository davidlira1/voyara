import { requireFlightStatus, type FlightStatus } from "../../domain/flights/flight-status.js";
import {
  requireReservationStatus,
  type ReservationStatus,
} from "../../domain/reservations/reservation-status.js";
import { createMoney, type Money } from "../../domain/shared/money.js";
import { InvalidReservationError } from "../errors.js";
import type { ReservationFacts } from "../ports/reservation-query-repository.js";

export type ReservationDetails = {
  readonly confirmationCode: string;
  readonly status: ReservationStatus;
  readonly customer: {
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly phone: string;
  };
  readonly flight: {
    readonly flightNumber: string;
    readonly departureAt: Date;
    readonly returnAt: Date;
    readonly status: FlightStatus;
  };
  readonly voyage: {
    readonly code: string;
    readonly name: string;
  };
  readonly travelClass: {
    readonly code: string;
    readonly name: string;
  };
  readonly passengers: readonly {
    readonly firstName: string;
    readonly lastName: string;
    readonly accommodationCode: string;
    readonly fare: Money;
  }[];
  readonly totalPrice: Money;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function normalizeConfirmationCode(confirmationCode: string): string {
  if (typeof confirmationCode !== "string" || confirmationCode.trim().length === 0) {
    throw new InvalidReservationError("Confirmation code must not be blank.");
  }

  return confirmationCode.trim();
}

export function toReservationDetails(facts: ReservationFacts): ReservationDetails {
  return {
    confirmationCode: facts.confirmationCode,
    status: requireReservationStatus(facts.status),
    customer: {
      firstName: facts.customerFirstName,
      lastName: facts.customerLastName,
      email: facts.customerEmail,
      phone: facts.customerPhone,
    },
    flight: {
      flightNumber: facts.flightNumber,
      departureAt: copyInstant(facts.departureAt),
      returnAt: copyInstant(facts.returnAt),
      status: requireFlightStatus(facts.flightStatus),
    },
    voyage: {
      code: facts.voyageCode,
      name: facts.voyageName,
    },
    travelClass: {
      code: facts.travelClassCode,
      name: facts.travelClassName,
    },
    passengers: facts.passengers.map((passenger) => ({
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      accommodationCode: passenger.accommodationCode,
      fare: createMoney(passenger.fareAmountMinor),
    })),
    totalPrice: createMoney(facts.totalPriceAmountMinor),
    createdAt: copyInstant(facts.createdAt),
    updatedAt: copyInstant(facts.updatedAt),
  };
}

function copyInstant(value: Date): Date {
  return new Date(value.getTime());
}
