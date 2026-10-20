import type { Clock } from "../application/clock.js";
import { systemClock } from "../application/clock.js";
import { createBookingIdGenerator } from "../infrastructure/identity/confirmation-code.js";
import type { PrismaClient } from "../infrastructure/persistence/prisma/client.js";
import { createPrismaFlightQueryRepository } from "../infrastructure/persistence/prisma/repositories/flight-query-repository.js";
import { createPrismaReservationBooking } from "../infrastructure/persistence/prisma/repositories/reservation-booking.js";
import { createPrismaReservationCancellation } from "../infrastructure/persistence/prisma/repositories/reservation-cancellation.js";
import { createPrismaReservationQueryRepository } from "../infrastructure/persistence/prisma/repositories/reservation-query-repository.js";
import { createPrismaVoyageQueryRepository } from "../infrastructure/persistence/prisma/repositories/voyage-query-repository.js";
import { createHttpServer, type HttpDependencies, type HttpLog } from "./server.js";
import type { Server } from "node:http";

export function composeHttpServer(input: {
  prisma: PrismaClient;
  devAccessToken: string;
  clock?: Clock;
  log?: HttpLog;
  maxBodyBytes?: number;
}): Server {
  const dependencies: HttpDependencies = {
    voyages: createPrismaVoyageQueryRepository(input.prisma),
    flights: createPrismaFlightQueryRepository(input.prisma),
    bookings: createPrismaReservationBooking(input.prisma),
    reservations: createPrismaReservationQueryRepository(input.prisma),
    cancellations: createPrismaReservationCancellation(input.prisma),
    ids: createBookingIdGenerator(),
    clock: input.clock ?? systemClock,
    devAccessToken: input.devAccessToken,
    ...(input.maxBodyBytes === undefined
      ? {}
      : { maxBodyBytes: input.maxBodyBytes }),
    ...(input.log === undefined ? {} : { log: input.log }),
  };

  return createHttpServer(dependencies);
}
