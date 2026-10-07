import type { Voyage as VoyageRecord } from "../../../../../generated/prisma/client.js";
import { createVoyage, type Voyage } from "../../../../domain/voyages/voyage.js";
import { moneyToDomain, moneyToPersistence } from "./money-mapper.js";

export function voyageToDomain(record: VoyageRecord): Voyage {
  return createVoyage({
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    durationMinutes: record.durationMinutes,
    baseFare: moneyToDomain(record.baseFareAmountMinor, record.baseFareCurrency),
  });
}

export function voyageToPersistence(voyage: Voyage): {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  baseFareAmountMinor: bigint;
  baseFareCurrency: string;
} {
  const fare = moneyToPersistence(voyage.baseFare);

  return {
    id: voyage.id,
    code: voyage.code,
    name: voyage.name,
    description: voyage.description,
    durationMinutes: voyage.durationMinutes,
    baseFareAmountMinor: fare.amountMinor,
    baseFareCurrency: fare.currency,
  };
}
