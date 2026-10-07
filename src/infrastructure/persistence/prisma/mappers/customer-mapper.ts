import type { Customer as CustomerRecord } from "../../../../../generated/prisma/client.js";
import {
  createCustomer,
  type Customer,
} from "../../../../domain/customers/customer.js";

export function customerToDomain(record: CustomerRecord): Customer {
  return createCustomer({
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    phone: record.phone,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function customerToPersistence(customer: Customer): {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
