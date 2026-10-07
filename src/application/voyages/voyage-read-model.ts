import { createMoney, type Money } from "../../domain/shared/money.js";
import type { VoyageFacts } from "../ports/voyage-query-repository.js";

export type VoyageSummary = {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly baseFare: Money;
};

export function toVoyageSummary(facts: VoyageFacts): VoyageSummary {
  return {
    code: facts.code,
    name: facts.name,
    description: facts.description,
    durationMinutes: facts.durationMinutes,
    baseFare: createMoney(facts.baseFareAmountMinor),
  };
}
