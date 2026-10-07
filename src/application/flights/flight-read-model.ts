import { requireFlightStatus, type FlightStatus } from "../../domain/flights/flight-status.js";
import {
  createFareMultiplier,
  createMoney,
  multiplyMoney,
  type Money,
} from "../../domain/shared/money.js";
import type {
  FlightClassFacts,
  FlightFacts,
} from "../ports/flight-query-repository.js";

export type TravelClassAvailability = {
  readonly code: string;
  readonly name: string;
  readonly farePerPassenger: Money;
  readonly availableCount: number;
};

export type FlightSearchResult = {
  readonly flightNumber: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly status: FlightStatus;
  readonly voyage: {
    readonly code: string;
    readonly name: string;
  };
  readonly spacecraft: {
    readonly code: string;
    readonly name: string;
    readonly familyCode: string;
    readonly familyName: string;
  };
  readonly classes: readonly TravelClassAvailability[];
};

export type FlightClassAvailabilityDetail = TravelClassAvailability & {
  readonly totalCount: number;
  readonly availableAccommodationCodes: readonly string[];
};

export type FlightAvailability = {
  readonly flightNumber: string;
  readonly classes: readonly FlightClassAvailabilityDetail[];
};

export function toFlightSearchResult(facts: FlightFacts): FlightSearchResult {
  const baseFare = createMoney(facts.baseFareAmountMinor);

  return {
    flightNumber: facts.flightNumber,
    departureAt: copyInstant(facts.departureAt),
    returnAt: copyInstant(facts.returnAt),
    status: requireFlightStatus(facts.status),
    voyage: {
      code: facts.voyageCode,
      name: facts.voyageName,
    },
    spacecraft: { ...facts.spacecraft },
    classes: facts.classes.map((travelClass) =>
      toClassAvailability(baseFare, travelClass),
    ),
  };
}

export function toClassAvailability(
  baseFare: Money,
  travelClass: FlightClassFacts,
): TravelClassAvailability {
  return {
    code: travelClass.code,
    name: travelClass.name,
    availableCount: travelClass.availableCount,
    farePerPassenger: multiplyMoney(
      baseFare,
      createFareMultiplier(travelClass.numerator, travelClass.denominator),
    ),
  };
}

function copyInstant(value: Date): Date {
  return new Date(value.getTime());
}
