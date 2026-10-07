import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidSearchCriteriaError } from "../errors.js";
import type { FlightQueryRepository } from "../ports/flight-query-repository.js";
import type { FlightSearchQuery } from "./flight-search-criteria.js";
import { searchFlights } from "./flight-queries.js";

describe("searchFlights reference time", () => {
  it("sends the clock instant to the query", async () => {
    const asOf = new Date("2026-10-07T12:00:00.000Z");
    const seen: FlightSearchQuery[] = [];
    await searchFlights(recordingRepository(seen), { voyageCode: "ORB-07" }, {
      now: () => asOf,
    });

    asOf.setTime(0);

    assert.equal(seen[0]?.asOf.toISOString(), "2026-10-07T12:00:00.000Z");
    assert.equal(seen[0]?.voyageCode, "ORB-07");
  });

  it("rejects an invalid clock instant", async () => {
    await assert.rejects(
      () =>
        searchFlights(recordingRepository([]), {}, {
          now: () => new Date("not-a-date"),
        }),
      InvalidSearchCriteriaError,
    );
  });
});

function recordingRepository(seen: FlightSearchQuery[]): FlightQueryRepository {
  return {
    async search(criteria) {
      seen.push(criteria);
      return [];
    },
    async findByFlightNumber() {
      return null;
    },
    async findAvailability() {
      return null;
    },
  };
}
