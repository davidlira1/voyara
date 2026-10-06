import type { CustomerRepository } from "../../../../application/ports/customer-repository.js";
import type { PrismaClient } from "../client.js";
import {
  customerToDomain,
  customerToPersistence,
} from "../mappers/customer-mapper.js";

export function createPrismaCustomerRepository(
  prisma: PrismaClient,
): CustomerRepository {
  return {
    async findById(id) {
      const record = await prisma.customer.findUnique({ where: { id } });
      return record === null ? null : customerToDomain(record);
    },

    async save(customer) {
      const data = customerToPersistence(customer);
      const { id, ...updates } = data;

      await prisma.customer.upsert({
        where: { id },
        create: data,
        update: updates,
      });
    },
  };
}
