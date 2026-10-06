import type { Passenger } from "../../domain/passengers/passenger.js";
import type { PassengerId } from "../../domain/shared/entity-id.js";

export type PassengerRepository = {
  findById(id: PassengerId): Promise<Passenger | null>;
  save(passenger: Passenger): Promise<void>;
};
