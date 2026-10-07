import type { VoyageId } from "../../domain/shared/entity-id.js";
import type { Voyage } from "../../domain/voyages/voyage.js";

export type VoyageRepository = {
  findById(id: VoyageId): Promise<Voyage | null>;
  findByCode(code: string): Promise<Voyage | null>;
  save(voyage: Voyage): Promise<void>;
};
