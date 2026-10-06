import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "./domain-error.js";
import {
  createFareMultiplier,
  createMoney,
  multiplyMoney,
} from "./money.js";

describe("createMoney", () => {
  it("accepts zero minor units", () => {
    assert.deepEqual(createMoney(0), { amountMinor: 0, currency: "USD" });
  });

  it("rejects a negative amount", () => {
    assert.throws(() => createMoney(-1), DomainInvariantError);
  });

  it("rejects a fractional amount", () => {
    assert.throws(() => createMoney(1.5), DomainInvariantError);
  });
});

describe("multiplyMoney", () => {
  const aresBaseFare = createMoney(1_250_000);

  it("prices Voyager+ as $12,500 × 1.4 = $17,500", () => {
    const voyagerPlus = createFareMultiplier(7, 5);

    assert.deepEqual(multiplyMoney(aresBaseFare, voyagerPlus), {
      amountMinor: 1_750_000,
      currency: "USD",
    });
  });

  it("prices Celestial as $12,500 × 2.5 = $31,250", () => {
    const celestial = createFareMultiplier(5, 2);

    assert.deepEqual(multiplyMoney(aresBaseFare, celestial), {
      amountMinor: 3_125_000,
      currency: "USD",
    });
  });

  it("rounds a remainder of half a minor unit away from zero", () => {
    assert.equal(
      multiplyMoney(createMoney(1), createFareMultiplier(1, 2)).amountMinor,
      1,
    );
  });

  it("rounds a remainder below half a minor unit down", () => {
    assert.equal(
      multiplyMoney(createMoney(1), createFareMultiplier(1, 3)).amountMinor,
      0,
    );
  });
});

describe("createFareMultiplier", () => {
  it("rejects a multiplier that is not greater than zero", () => {
    assert.throws(() => createFareMultiplier(0, 1), DomainInvariantError);
    assert.throws(() => createFareMultiplier(-1, 1), DomainInvariantError);
    assert.throws(() => createFareMultiplier(1, 0), DomainInvariantError);
  });

  it("rejects a fractional ratio part", () => {
    assert.throws(() => createFareMultiplier(1.4, 1), DomainInvariantError);
  });
});
