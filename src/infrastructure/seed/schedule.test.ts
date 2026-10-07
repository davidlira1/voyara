import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TURNAROUND_MINUTES, vehicleCatalog } from "./catalog.js";
import {
  generateSchedule,
  type ScheduleResult,
  type ScheduledFlight,
} from "./schedule.js";

const anchor = new Date("2026-10-07T15:00:00.000Z");
const schedule = generateSchedule(anchor);
const turnaroundMs = TURNAROUND_MINUTES * 60 * 1000;

describe("generateSchedule", () => {
  it("builds the same schedule for any time on the same UTC day", () => {
    const morning = signature(
      generateSchedule(new Date("2026-10-07T01:00:00.000Z")),
    );
    const evening = signature(
      generateSchedule(new Date("2026-10-07T22:00:00.000Z")),
    );

    assert.deepEqual(morning, evening);
    assert.deepEqual(signature(generateSchedule(anchor)), morning);
  });

  it("covers the 365 days after the anchor without overlapping a vehicle", () => {
    const horizonStart = Date.parse("2026-10-08T00:00:00.000Z");
    const horizonEnd = Date.parse("2027-10-08T00:00:00.000Z");
    const departures = schedule.flights.map((flight) =>
      flight.departureAt.getTime(),
    );

    assert.ok(Math.min(...departures) >= horizonStart);
    assert.ok(Math.max(...departures) < horizonEnd);
    assert.ok(Math.max(...departures) >= Date.parse("2027-10-01T00:00:00.000Z"));

    for (const flight of schedule.flights) {
      assert.ok(flight.returnAt.getTime() > flight.departureAt.getTime());
    }

    for (const vehicleCode of new Set(
      schedule.flights.map((flight) => flight.vehicleCode),
    )) {
      const flights = schedule.flights
        .filter((flight) => flight.vehicleCode === vehicleCode)
        .sort(
          (left, right) =>
            left.departureAt.getTime() - right.departureAt.getTime(),
        );

      for (let index = 1; index < flights.length; index += 1) {
        const previous = flights[index - 1];
        const current = flights[index];

        if (previous === undefined || current === undefined) {
          continue;
        }

        assert.ok(
          current.departureAt.getTime() >=
            previous.returnAt.getTime() + turnaroundMs,
        );
      }
    }
  });

  it("assigns each voyage to its family fleet and inventory", () => {
    const familyByVehicle = new Map(
      vehicleCatalog.map((vehicle) => [vehicle.code, vehicle.familyCode]),
    );

    for (const flight of schedule.flights) {
      const family = familyByVehicle.get(flight.vehicleCode);
      assert.equal(family, expectedFamily(flight.voyageCode));

      if (family === "MERIDIAN") {
        assert.equal(flight.accommodations.length, 72);
        assert.equal(
          flight.accommodations.some((item) => item.code.startsWith("C")),
          false,
        );
        assert.equal(countClass(flight, "VOYAGER"), 48);
        assert.equal(countClass(flight, "VOYAGER_PLUS"), 24);
      }

      if (family === "ODYSSEY") {
        assert.equal(flight.accommodations.length, 48);
        assert.equal(countClass(flight, "VOYAGER"), 24);
        assert.equal(countClass(flight, "VOYAGER_PLUS"), 16);
        assert.equal(countClass(flight, "CELESTIAL"), 8);
      }
    }
  });

  it("skips the first Grand Tour when both Atlas ships are already out", () => {
    assert.ok(
      schedule.skipped.some(
        (candidate) =>
          candidate.voyageCode === "ORB-10" &&
          candidate.departureAt.toISOString() === "2026-10-08T09:00:00.000Z",
      ),
    );
    assert.ok(
      schedule.flights.some((flight) => flight.voyageCode === "ORB-10"),
    );
  });

  it("numbers assigned flights sequentially from VY-1001", () => {
    const numbers = schedule.flights.map((flight) => flight.flightNumber);
    assert.equal(new Set(numbers).size, numbers.length);
    assert.equal(numbers[0], "VY-1001");
    assert.equal(numbers.at(-1), `VY-${1000 + numbers.length}`);
  });
});

function expectedFamily(voyageCode: string): string {
  if (voyageCode === "ORB-01" || voyageCode === "ORB-02" || voyageCode === "ORB-03") {
    return "MERIDIAN";
  }

  if (voyageCode === "ORB-04" || voyageCode === "ORB-05") {
    return "HORIZON";
  }

  if (voyageCode === "ORB-06" || voyageCode === "ORB-07") {
    return "ODYSSEY";
  }

  return "ATLAS";
}

function countClass(flight: ScheduledFlight, travelClassCode: string): number {
  return flight.accommodations.filter(
    (accommodation) => accommodation.travelClassCode === travelClassCode,
  ).length;
}

function signature(result: ScheduleResult): string[] {
  return [
    ...result.flights.map(
      (flight) =>
        `${flight.flightNumber}|${flight.voyageCode}|${flight.vehicleCode}|${flight.departureAt.toISOString()}|${flight.accommodations.map((item) => item.code).join(",")}`,
    ),
    ...result.skipped.map(
      (candidate) =>
        `skip|${candidate.voyageCode}|${candidate.departureAt.toISOString()}`,
    ),
  ];
}
