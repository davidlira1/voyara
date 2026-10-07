import type { PrismaClient } from "./client.js";

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "reservation_passengers",
      "reservations",
      "flight_accommodations",
      "flights",
      "vehicles",
      "vehicle_family_travel_classes",
      "vehicle_families",
      "passengers",
      "customers",
      "travel_classes",
      "voyages"
    RESTART IDENTITY CASCADE
  `);
}
