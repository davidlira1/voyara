import type { FlightSearchQuery } from "../flights/flight-search-criteria.js";

export type FlightClassFacts = {
  readonly code: string;
  readonly name: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly totalCount: number;
  readonly availableCount: number;
};

export type FlightFacts = {
  readonly flightNumber: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly status: string;
  readonly voyageCode: string;
  readonly voyageName: string;
  readonly baseFareAmountMinor: number;
  readonly classes: readonly FlightClassFacts[];
  readonly spacecraft: {
    readonly code: string;
    readonly name: string;
    readonly familyCode: string;
    readonly familyName: string;
  };
};

export type FlightAvailabilityFacts = {
  readonly flightNumber: string;
  readonly baseFareAmountMinor: number;
  readonly classes: readonly (FlightClassFacts & {
    readonly availableAccommodationCodes: readonly string[];
  })[];
};

export type FlightQueryRepository = {
  search(criteria: FlightSearchQuery): Promise<readonly FlightFacts[]>;
  findByFlightNumber(flightNumber: string): Promise<FlightFacts | null>;
  findAvailability(
    flightNumber: string,
  ): Promise<FlightAvailabilityFacts | null>;
};
