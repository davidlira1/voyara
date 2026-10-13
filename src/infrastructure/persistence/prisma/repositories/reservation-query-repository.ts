import type { ReservationQueryRepository } from "../../../../application/ports/reservation-query-repository.js";
import type { PrismaClient } from "../client.js";
import { loadReservationSnapshot } from "../reservation-snapshot.js";

export function createPrismaReservationQueryRepository(
  prisma: PrismaClient,
): ReservationQueryRepository {
  return {
    async findByConfirmationCode(confirmationCode) {
      const snapshot = await loadReservationSnapshot(
        prisma,
        confirmationCode,
        false,
      );

      return snapshot === null ? null : snapshot.details;
    },
  };
}
