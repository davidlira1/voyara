import { Prisma } from "../../../../../generated/prisma/client.js";
import type {
  ReservationCancellation,
  ReservationCancellationUnit,
} from "../../../../application/ports/reservation-cancellation.js";
import type { PrismaClient } from "../client.js";
import { loadReservationSnapshot } from "../reservation-snapshot.js";

export function createPrismaReservationCancellation(
  prisma: PrismaClient,
): ReservationCancellation {
  return {
    async transact(work) {
      return prisma.$transaction((tx) => work(createUnit(tx)), {
        timeout: 20_000,
      });
    },
  };
}

function createUnit(tx: Prisma.TransactionClient): ReservationCancellationUnit {
  return {
    async lockByConfirmationCode(confirmationCode: string) {
      return loadReservationSnapshot(tx, confirmationCode, true);
    },

    async markCancelled(id: string, updatedAt: Date) {
      await tx.reservation.update({
        where: { id },
        data: {
          status: "CANCELLED",
          updatedAt,
        },
      });
    },
  };
}
