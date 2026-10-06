import {
  createTravelClassId,
  type TravelClassId,
} from "../shared/entity-id.js";
import {
  requireFareMultiplier,
  type FareMultiplier,
} from "../shared/money.js";
import { requireNonEmpty } from "../shared/non-empty.js";

export type TravelClass = {
  readonly id: TravelClassId;
  readonly code: string;
  readonly name: string;
  readonly fareMultiplier: FareMultiplier;
};

export type CreateTravelClassInput = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly fareMultiplier: FareMultiplier;
};

export function createTravelClass(input: CreateTravelClassInput): TravelClass {
  return Object.freeze({
    id: createTravelClassId(input.id),
    code: requireNonEmpty(input.code, "Travel class code"),
    name: requireNonEmpty(input.name, "Travel class name"),
    fareMultiplier: requireFareMultiplier(input.fareMultiplier),
  });
}
