import type { Clock } from "../application/clock.js";
import type { FlightQueryRepository } from "../application/ports/flight-query-repository.js";
import type { IdGenerator } from "../application/ports/id-generator.js";
import type { LanguageModel } from "../application/ports/language-model.js";
import type { ReservationBooking } from "../application/ports/reservation-booking.js";
import type { ReservationCancellation } from "../application/ports/reservation-cancellation.js";
import type { ReservationQueryRepository } from "../application/ports/reservation-query-repository.js";
import type { VoyageQueryRepository } from "../application/ports/voyage-query-repository.js";

export type HttpLog = {
  access(entry: {
    method: string;
    route: string;
    status: number;
  }): void;
  failure(entry: { route: string; errorName: string }): void;
};

export type HttpDependencies = {
  readonly voyages: VoyageQueryRepository;
  readonly flights: FlightQueryRepository;
  readonly bookings: ReservationBooking;
  readonly reservations: ReservationQueryRepository;
  readonly cancellations: ReservationCancellation;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly devAccessToken: string;
  readonly languageModel: LanguageModel;
  readonly maxBodyBytes?: number;
  readonly log?: HttpLog;
};
