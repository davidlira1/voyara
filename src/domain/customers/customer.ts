import { createCustomerId, type CustomerId } from "../shared/entity-id.js";
import { requireNonEmpty } from "../shared/non-empty.js";
import { requireInstant } from "../shared/time.js";

export type Customer = {
  readonly id: CustomerId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateCustomerInput = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createCustomer(input: CreateCustomerInput): Customer {
  return Object.freeze({
    id: createCustomerId(input.id),
    firstName: requireNonEmpty(input.firstName, "Customer first name"),
    lastName: requireNonEmpty(input.lastName, "Customer last name"),
    email: requireNonEmpty(input.email, "Customer email"),
    phone: requireNonEmpty(input.phone, "Customer phone"),
    createdAt: requireInstant(input.createdAt, "Customer created at"),
    updatedAt: requireInstant(input.updatedAt, "Customer updated at"),
  });
}
