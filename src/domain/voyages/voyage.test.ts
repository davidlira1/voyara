import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createMoney } from "../shared/money.js";
import { createVoyage, type CreateVoyageInput } from "./voyage.js";

const ares: CreateVoyageInput = {
  id: "voyage-1",
  code: "ORB-07",
  name: "Ares",
  description: "Mars flyby with extended observation window",
  durationMinutes: 40 * 60,
  baseFare: createMoney(1_250_000),
};

describe("createVoyage", () => {
  it("creates a voyage with the supplied id", () => {
    const voyage = createVoyage(ares);

    assert.equal(voyage.id, "voyage-1");
    assert.equal(voyage.code, "ORB-07");
    assert.equal(voyage.durationMinutes, 2400);
    assert.equal(voyage.baseFare.amountMinor, 1_250_000);
  });

  it("rejects a non-positive duration", () => {
    assert.throws(
      () => createVoyage({ ...ares, durationMinutes: 0 }),
      DomainInvariantError,
    );
    assert.throws(
      () => createVoyage({ ...ares, durationMinutes: -10 }),
      DomainInvariantError,
    );
  });

  it("rejects a fractional duration", () => {
    assert.throws(
      () => createVoyage({ ...ares, durationMinutes: 1.5 }),
      DomainInvariantError,
    );
  });

  it("rejects a negative base fare", () => {
    assert.throws(
      () =>
        createVoyage({
          ...ares,
          baseFare: { amountMinor: -1, currency: "USD" },
        }),
      DomainInvariantError,
    );
  });

  it("allows a zero base fare", () => {
    const voyage = createVoyage({ ...ares, baseFare: createMoney(0) });

    assert.equal(voyage.baseFare.amountMinor, 0);
  });

  it("rejects a blank code", () => {
    assert.throws(
      () => createVoyage({ ...ares, code: "   " }),
      DomainInvariantError,
    );
  });
});
