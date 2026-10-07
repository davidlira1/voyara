import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidSearchCriteriaError } from "../errors.js";
import {
  DEFAULT_FLIGHT_SEARCH_LIMIT,
  MAX_FLIGHT_SEARCH_LIMIT,
  normalizeFlightSearchCriteria,
} from "./flight-search-criteria.js";

describe("normalizeFlightSearchCriteria", () => {
  it("applies the default limit", () => {
    assert.equal(
      normalizeFlightSearchCriteria({}).limit,
      DEFAULT_FLIGHT_SEARCH_LIMIT,
    );
  });

  it("rejects a reversed departure window", () => {
    assert.throws(
      () =>
        normalizeFlightSearchCriteria({
          departureFrom: new Date("2026-11-06T00:00:00.000Z"),
          departureTo: new Date("2026-11-05T00:00:00.000Z"),
        }),
      InvalidSearchCriteriaError,
    );
  });

  it("rejects non-positive counts and limits above the maximum", () => {
    assert.throws(
      () => normalizeFlightSearchCriteria({ passengerCount: 0 }),
      InvalidSearchCriteriaError,
    );
    assert.throws(
      () => normalizeFlightSearchCriteria({ passengerCount: 1.5 }),
      InvalidSearchCriteriaError,
    );
    assert.throws(
      () => normalizeFlightSearchCriteria({ limit: 0 }),
      InvalidSearchCriteriaError,
    );
    assert.throws(
      () =>
        normalizeFlightSearchCriteria({
          limit: MAX_FLIGHT_SEARCH_LIMIT + 1,
        }),
      InvalidSearchCriteriaError,
    );
  });

  it("copies departure instants", () => {
    const departureFrom = new Date("2026-11-05T00:00:00.000Z");
    const normalized = normalizeFlightSearchCriteria({ departureFrom });

    departureFrom.setTime(0);

    assert.equal(
      normalized.departureFrom?.toISOString(),
      "2026-11-05T00:00:00.000Z",
    );
  });
});
