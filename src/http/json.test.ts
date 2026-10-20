import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "./errors.js";
import { parseFlightSearchQuery } from "./json.js";

describe("ISO timestamp query parsing", () => {
  it("accepts real instants, including offsets and short fractional seconds", () => {
    assert.equal(
      departure("2026-11-05T09:00:00.000Z")?.toISOString(),
      "2026-11-05T09:00:00.000Z",
    );
    assert.equal(
      departure("2024-02-29T00:00:00.000Z")?.toISOString(),
      "2024-02-29T00:00:00.000Z",
    );
    assert.equal(
      departure("2000-02-29T12:00:00Z")?.toISOString(),
      "2000-02-29T12:00:00.000Z",
    );
    assert.equal(
      departure("2026-11-05T09:00:00.5Z")?.toISOString(),
      "2026-11-05T09:00:00.500Z",
    );
    assert.equal(
      departure("2026-11-05T09:00:00.000+05:30")?.toISOString(),
      "2026-11-05T03:30:00.000Z",
    );
    assert.equal(
      departure("2026-11-05T00:00:00.000-05:00")?.toISOString(),
      "2026-11-05T05:00:00.000Z",
    );
  });

  it("rejects impossible calendar dates and invalid offsets", () => {
    const rejected = [
      "2026-02-31T00:00:00.000Z",
      "2026-04-31T00:00:00.000Z",
      "2026-02-29T00:00:00.000Z",
      "1900-02-29T00:00:00.000Z",
      "2026-00-01T00:00:00.000Z",
      "2026-01-00T00:00:00.000Z",
      "2026-11-05T24:00:00.000Z",
      "2026-11-05T12:60:00.000Z",
      "2026-11-05T12:00:60.000Z",
      "2026-11-05T00:00:00.000+24:00",
      "2026-11-05T00:00:00.000+99:00",
      "2026-11-05T00:00:00.000+14:60",
      "0001-01-01T00:00:00.000Z",
    ];

    for (const value of rejected) {
      assert.throws(
        () => departure(value),
        (error: unknown) => {
          assert.ok(error instanceof HttpError, value);
          assert.equal(error.code, "INVALID_SEARCH_CRITERIA");
          assert.equal(error.message, "Search criteria are invalid.");
          return true;
        },
      );
    }
  });
});

function departure(value: string): Date | undefined {
  return parseFlightSearchQuery(new URLSearchParams({ departureFrom: value }))
    .departureFrom;
}
