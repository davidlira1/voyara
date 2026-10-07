import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFareMultiplier,
  createMoney,
  multiplyMoney,
} from "../../domain/shared/money.js";
import { voyageByCode } from "./catalog.js";
import {
  buildDemoScenarios,
  duplicateActiveClaims,
  selectAresDemoFlight,
  type DemoReservationPlan,
} from "./demo-scenarios.js";
import { generateSchedule } from "./schedule.js";

const anchor = new Date("2026-10-07T15:00:00.000Z");
const schedule = generateSchedule(anchor);
const plans = buildDemoScenarios(schedule, anchor);

describe("demo scenarios", () => {
  it("places Dolly on the Ares flight nearest 30 days after the anchor", () => {
    const dolly = plan("DLY-ARES");
    const firstAres = schedule.flights.find(
      (flight) => flight.voyageCode === "ORB-07",
    );
    const chosen = selectAresDemoFlight(schedule, anchor);

    assert.equal(dolly.flightNumber, chosen.flightNumber);
    assert.notEqual(dolly.flightNumber, firstAres?.flightNumber);
    assert.equal(chosen.departureAt.toISOString(), "2026-11-05T10:30:00.000Z");
    assert.deepEqual(
      dolly.passengers.map((passenger) => passenger.accommodationCode),
      ["P01", "P02", "P03"],
    );
    assert.equal(dolly.travelClassCode, "VOYAGER_PLUS");
    assert.equal(dolly.status, "CONFIRMED");
    assert.equal(quotedTotal(dolly), 5_250_000);
  });

  it("leaves three Voyager+ seats together and no four on Dolly's flight", () => {
    const flightNumber = plan("DLY-ARES").flightNumber;
    const occupied = new Set(
      plans
        .filter(
          (item) =>
            item.flightNumber === flightNumber &&
            item.travelClassCode === "VOYAGER_PLUS" &&
            item.status !== "CANCELLED",
        )
        .flatMap((item) =>
          item.passengers.map((passenger) => passenger.accommodationCode),
        ),
    );
    const available = ["P04", "P08", "P09", "P10", "P12", "P13", "P14"];

    assert.deepEqual(
      [...occupied].sort(),
      ["P01", "P02", "P03", "P05", "P06", "P07", "P11", "P15", "P16"],
    );

    const groups = consecutiveGroups(available);
    assert.equal(Math.max(...groups), 3);
    assert.equal(
      groups.some((length) => length >= 4),
      false,
    );
  });

  it("keeps one active claim when a cancelled assignment shares an accommodation", () => {
    const polar = plans.filter((item) =>
      item.passengers.some(
        (passenger) =>
          passenger.accommodationCode === "V01" && item.voyageCode === "ORB-03",
      ),
    );

    assert.deepEqual(
      polar.map((item) => item.status).sort(),
      ["CANCELLED", "CONFIRMED"],
    );
    assert.deepEqual(duplicateActiveClaims(plans), []);
  });

  it("distinguishes Alex the customer from the passengers who travel", () => {
    const alex = plan("ALX-BLUE");
    const names = alex.passengers.map(
      (passenger) => `${passenger.firstName} ${passenger.lastName}`,
    );

    assert.equal(alex.customer.firstName, "Alex");
    assert.deepEqual(names, ["Jamie Example", "Taylor Example"]);
  });
});

function plan(confirmationCode: string): DemoReservationPlan {
  const found = plans.find(
    (item) => item.confirmationCode === confirmationCode,
  );

  if (found === undefined) {
    throw new Error(`Missing plan ${confirmationCode}.`);
  }

  return found;
}

function quotedTotal(reservation: DemoReservationPlan): number {
  const voyage = voyageByCode(reservation.voyageCode);
  const multiplier =
    reservation.travelClassCode === "VOYAGER_PLUS"
      ? createFareMultiplier(7, 5)
      : createFareMultiplier(1, 1);
  const fare = multiplyMoney(createMoney(voyage.baseFareMinor), multiplier);

  return fare.amountMinor * reservation.passengers.length;
}

function consecutiveGroups(codes: readonly string[]): number[] {
  const numbers = codes
    .map((code) => Number(code.slice(1)))
    .sort((left, right) => left - right);
  const groups: number[] = [];
  let length = 0;
  let previous = 0;

  for (const number of numbers) {
    if (length > 0 && number === previous + 1) {
      length += 1;
    } else {
      if (length > 0) {
        groups.push(length);
      }
      length = 1;
    }
    previous = number;
  }

  if (length > 0) {
    groups.push(length);
  }

  return groups;
}
