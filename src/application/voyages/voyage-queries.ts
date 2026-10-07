import { VoyageNotFoundError } from "../errors.js";
import type { VoyageQueryRepository } from "../ports/voyage-query-repository.js";
import { toVoyageSummary, type VoyageSummary } from "./voyage-read-model.js";

export async function listVoyages(
  voyages: VoyageQueryRepository,
): Promise<readonly VoyageSummary[]> {
  const facts = await voyages.list();
  return facts.map(toVoyageSummary);
}

export async function getVoyage(
  voyages: VoyageQueryRepository,
  code: string,
): Promise<VoyageSummary> {
  const facts = await voyages.findByCode(code);

  if (facts === null) {
    throw new VoyageNotFoundError(code);
  }

  return toVoyageSummary(facts);
}
