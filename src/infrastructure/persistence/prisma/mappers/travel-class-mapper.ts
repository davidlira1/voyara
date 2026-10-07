import type { TravelClass as TravelClassRecord } from "../../../../../generated/prisma/client.js";
import {
  createTravelClass,
  type TravelClass,
} from "../../../../domain/travel-classes/travel-class.js";
import { createFareMultiplier } from "../../../../domain/shared/money.js";

export function travelClassToDomain(record: TravelClassRecord): TravelClass {
  return createTravelClass({
    id: record.id,
    code: record.code,
    name: record.name,
    fareMultiplier: createFareMultiplier(
      record.fareMultiplierNumerator,
      record.fareMultiplierDenominator,
    ),
  });
}

export function travelClassToPersistence(travelClass: TravelClass): {
  id: string;
  code: string;
  name: string;
  fareMultiplierNumerator: number;
  fareMultiplierDenominator: number;
} {
  return {
    id: travelClass.id,
    code: travelClass.code,
    name: travelClass.name,
    fareMultiplierNumerator: travelClass.fareMultiplier.numerator,
    fareMultiplierDenominator: travelClass.fareMultiplier.denominator,
  };
}
