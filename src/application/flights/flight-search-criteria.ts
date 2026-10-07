import { InvalidSearchCriteriaError } from "../errors.js";

export const DEFAULT_FLIGHT_SEARCH_LIMIT = 20;
export const MAX_FLIGHT_SEARCH_LIMIT = 100;

export type FlightSearchCriteria = {
  readonly voyageCode?: string;
  readonly departureFrom?: Date;
  readonly departureTo?: Date;
  readonly travelClassCode?: string;
  readonly passengerCount?: number;
  readonly limit?: number;
};

export type NormalizedFlightSearchCriteria = {
  readonly voyageCode?: string;
  readonly departureFrom?: Date;
  readonly departureTo?: Date;
  readonly travelClassCode?: string;
  readonly passengerCount?: number;
  readonly limit: number;
};

export type FlightSearchQuery = NormalizedFlightSearchCriteria & {
  readonly asOf: Date;
};

export function normalizeFlightSearchCriteria(
  criteria: FlightSearchCriteria,
): NormalizedFlightSearchCriteria {
  const voyageCode = optionalCode(criteria.voyageCode, "Voyage code");
  const travelClassCode = optionalCode(
    criteria.travelClassCode,
    "Travel class code",
  );
  const departureFrom = optionalInstant(
    criteria.departureFrom,
    "Departure from",
  );
  const departureTo = optionalInstant(criteria.departureTo, "Departure to");

  if (
    departureFrom !== undefined &&
    departureTo !== undefined &&
    departureTo.getTime() < departureFrom.getTime()
  ) {
    throw new InvalidSearchCriteriaError(
      "Departure to must not precede departure from.",
    );
  }

  return {
    ...(voyageCode === undefined ? {} : { voyageCode }),
    ...(travelClassCode === undefined ? {} : { travelClassCode }),
    ...(departureFrom === undefined ? {} : { departureFrom }),
    ...(departureTo === undefined ? {} : { departureTo }),
    ...(criteria.passengerCount === undefined
      ? {}
      : { passengerCount: positiveInteger(criteria.passengerCount, "Passenger count") }),
    limit:
      criteria.limit === undefined
        ? DEFAULT_FLIGHT_SEARCH_LIMIT
        : boundedLimit(criteria.limit),
  };
}

function optionalCode(value: string | undefined, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const code = value.trim();

  if (code.length === 0) {
    throw new InvalidSearchCriteriaError(`${label} must not be blank.`);
  }

  return code;
}

function optionalInstant(value: Date | undefined, label: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidSearchCriteriaError(`${label} must be a valid instant.`);
  }

  return new Date(value.getTime());
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidSearchCriteriaError(
      `${label} must be a positive integer.`,
    );
  }

  return value;
}

function boundedLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidSearchCriteriaError("Limit must be a positive integer.");
  }

  if (value > MAX_FLIGHT_SEARCH_LIMIT) {
    throw new InvalidSearchCriteriaError(
      `Limit must not exceed ${MAX_FLIGHT_SEARCH_LIMIT}.`,
    );
  }

  return value;
}
