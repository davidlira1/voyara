import type {
  VoyageFacts,
  VoyageQueryRepository,
} from "../../../../application/ports/voyage-query-repository.js";
import { moneyToDomain } from "../mappers/money-mapper.js";
import type { PrismaClient } from "../client.js";

export function createPrismaVoyageQueryRepository(
  prisma: PrismaClient,
): VoyageQueryRepository {
  return {
    async list() {
      const records = await prisma.voyage.findMany({
        orderBy: { code: "asc" },
      });
      return records.map(toFacts);
    },

    async findByCode(code) {
      const record = await prisma.voyage.findUnique({ where: { code } });
      return record === null ? null : toFacts(record);
    },
  };
}

function toFacts(record: {
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  baseFareAmountMinor: bigint;
  baseFareCurrency: string;
}): VoyageFacts {
  const baseFare = moneyToDomain(
    record.baseFareAmountMinor,
    record.baseFareCurrency.trim(),
  );

  return {
    code: record.code,
    name: record.name,
    description: record.description,
    durationMinutes: record.durationMinutes,
    baseFareAmountMinor: baseFare.amountMinor,
  };
}
