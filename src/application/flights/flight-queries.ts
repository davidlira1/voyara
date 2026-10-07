import { createMoney } from "../../domain/shared/money.js";
import { systemClock, type Clock } from "../clock.js";
import { FlightNotFoundError, InvalidSearchCriteriaError } from "../errors.js";
import type { FlightQueryRepository } from "../ports/flight-query-repository.js";
import {
  normalizeFlightSearchCriteria,
  type FlightSearchCriteria,
} from "./flight-search-criteria.js";
import {
  toClassAvailability,
  toFlightSearchResult,
  type FlightAvailability,
  type FlightSearchResult,
} from "./flight-read-model.js";

export async function searchFlights(
  flights: FlightQueryRepository,
  criteria: FlightSearchCriteria = {},
  clock: Clock = systemClock,
): Promise<readonly FlightSearchResult[]> {
  const normalized = normalizeFlightSearchCriteria(criteria);
  const facts = await flights.search({
    ...normalized,
    asOf: referenceTime(clock),
  });
  return facts.map(toFlightSearchResult);
}

function referenceTime(clock: Clock): Date {
  const now = clock.now();

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new InvalidSearchCriteriaError(
      "Reference time must be a valid instant.",
    );
  }

  return new Date(now.getTime());
}

export async function getFlight(
  flights: FlightQueryRepository,
  flightNumber: string,
): Promise<FlightSearchResult> {
  const facts = await flights.findByFlightNumber(flightNumber);

  if (facts === null) {
    throw new FlightNotFoundError(flightNumber);
  }

  return toFlightSearchResult(facts);
}

export async function getFlightAvailability(
  flights: FlightQueryRepository,
  flightNumber: string,
): Promise<FlightAvailability> {
  const facts = await flights.findAvailability(flightNumber);

  if (facts === null) {
    throw new FlightNotFoundError(flightNumber);
  }

  const baseFare = createMoney(facts.baseFareAmountMinor);

  return {
    flightNumber: facts.flightNumber,
    classes: facts.classes.map((travelClass) => ({
      ...toClassAvailability(baseFare, travelClass),
      totalCount: travelClass.totalCount,
      availableAccommodationCodes: [
        ...travelClass.availableAccommodationCodes,
      ],
    })),
  };
}
