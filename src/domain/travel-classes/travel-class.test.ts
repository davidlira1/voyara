import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createFareMultiplier } from "../shared/money.js";
import { createTravelClass } from "./travel-class.js";

describe("createTravelClass", () => {
  it("accepts a positive fare multiplier", () => {
    const travelClass = createTravelClass({
      id: "class-voyager-plus",
      code: "VOYAGER_PLUS",
      name: "Voyager+",
      fareMultiplier: createFareMultiplier(7, 5),
    });

    assert.equal(travelClass.code, "VOYAGER_PLUS");
    assert.deepEqual(travelClass.fareMultiplier, {
      numerator: 7,
      denominator: 5,
    });
  });

  it("rejects a fare multiplier that is not greater than zero", () => {
    assert.throws(
      () =>
        createTravelClass({
          id: "class-voyager",
          code: "VOYAGER",
          name: "Voyager",
          fareMultiplier: { numerator: 0, denominator: 1 },
        }),
      DomainInvariantError,
    );
  });
});
