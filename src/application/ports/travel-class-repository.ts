import type { TravelClassId } from "../../domain/shared/entity-id.js";
import type { TravelClass } from "../../domain/travel-classes/travel-class.js";

export type TravelClassRepository = {
  findById(id: TravelClassId): Promise<TravelClass | null>;
  findByCode(code: string): Promise<TravelClass | null>;
  save(travelClass: TravelClass): Promise<void>;
};
