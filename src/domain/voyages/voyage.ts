import {
  createVoyageId,
  type VoyageId,
} from "../shared/entity-id.js";
import { requireMoney, type Money } from "../shared/money.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import { requirePositiveInteger } from "../shared/numbers.js";

export type Voyage = {
  readonly id: VoyageId;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly baseFare: Money;
};

export type CreateVoyageInput = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly baseFare: Money;
};

export function createVoyage(input: CreateVoyageInput): Voyage {
  return Object.freeze({
    id: createVoyageId(input.id),
    code: requireNonEmpty(input.code, "Voyage code"),
    name: requireNonEmpty(input.name, "Voyage name"),
    description: requireNonEmpty(input.description, "Voyage description"),
    durationMinutes: requirePositiveInteger(
      input.durationMinutes,
      "Voyage duration",
    ),
    baseFare: requireMoney(input.baseFare),
  });
}
