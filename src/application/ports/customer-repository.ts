import type { Customer } from "../../domain/customers/customer.js";
import type { CustomerId } from "../../domain/shared/entity-id.js";

export type CustomerRepository = {
  findById(id: CustomerId): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
};
