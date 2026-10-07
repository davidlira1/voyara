import { seedDatabase } from "./seed-database.js";

const anchor = parseAnchor(process.argv.slice(2));
const summary = await seedDatabase({ anchor });

console.log(`Seeded Voyara demo universe from ${summary.anchor.toISOString()}.`);
console.log(`Travel classes: ${summary.counts.travelClasses}`);
console.log(`Voyages: ${summary.counts.voyages}`);
console.log(`Vehicle families: ${summary.counts.vehicleFamilies}`);
console.log(`Family capacities: ${summary.counts.familyCapacities}`);
console.log(`Vehicles: ${summary.counts.vehicles}`);
console.log(`Flights: ${summary.counts.flights}`);
console.log(`Accommodations: ${summary.counts.accommodations}`);
console.log(`Customers: ${summary.counts.customers}`);
console.log(`Passengers: ${summary.counts.passengers}`);
console.log(`Reservations: ${summary.counts.reservations}`);
console.log(`Reservation passengers: ${summary.counts.reservationPassengers}`);
console.log(`Skipped candidates: ${summary.skipped.length}`);

for (const skipped of summary.skipped) {
  console.log(
    `- ${skipped.voyageCode} ${skipped.departureAt.toISOString()}`,
  );
}

console.log("Dolly Hart");
console.log(`  Confirmation: ${summary.dolly.confirmationCode}`);
console.log(`  Email: ${summary.dolly.email}`);
console.log(
  `  Flight: ${summary.dolly.flightNumber} ${summary.dolly.voyageCode} ${summary.dolly.voyageName}`,
);
console.log(`  Vehicle: ${summary.dolly.vehicleCode}`);
console.log(`  Departure: ${summary.dolly.departureAt.toISOString()}`);
console.log(`  Class: ${summary.dolly.travelClassCode}`);
console.log(`  Status: ${summary.dolly.status}`);
console.log(`  Total minor units: ${summary.dolly.totalPriceMinor}`);
console.log(`  Passengers: ${summary.dolly.passengers.join(", ")}`);
console.log(`  Accommodations: ${summary.dolly.accommodations.join(", ")}`);

function parseAnchor(argv: readonly string[]): Date {
  const flagIndex = argv.indexOf("--anchor");
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;

  if (flagIndex >= 0 && flagValue === undefined) {
    throw new Error(
      "Anchor must be YYYY-MM-DD. Pass --anchor 2026-10-07 or set SEED_ANCHOR_DATE.",
    );
  }

  const raw = flagValue ?? process.env.SEED_ANCHOR_DATE;

  if (raw === undefined) {
    return new Date();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      "Anchor must be YYYY-MM-DD. Pass --anchor 2026-10-07 or set SEED_ANCHOR_DATE.",
    );
  }

  const [yearText, monthText, dayText] = raw.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const anchor = new Date(Date.UTC(year, month - 1, day));

  if (
    anchor.getUTCFullYear() !== year ||
    anchor.getUTCMonth() !== month - 1 ||
    anchor.getUTCDate() !== day
  ) {
    throw new Error(`Anchor ${raw} is not a real calendar day.`);
  }

  return anchor;
}
