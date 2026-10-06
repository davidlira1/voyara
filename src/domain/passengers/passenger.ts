import { createPassengerId, type PassengerId } from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import { requireInstant } from "../shared/time.js";

export type Passenger = {
  readonly id: PassengerId;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreatePassengerInput = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createPassenger(input: CreatePassengerInput): Passenger {
  return Object.freeze({
    id: createPassengerId(input.id),
    firstName: requireNonEmpty(input.firstName, "Passenger first name"),
    lastName: requireNonEmpty(input.lastName, "Passenger last name"),
    createdAt: requireInstant(input.createdAt, "Passenger created at"),
    updatedAt: requireInstant(input.updatedAt, "Passenger updated at"),
  });
}
