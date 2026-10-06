import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createVehicleFamilyTravelClass } from "./vehicle-family-travel-class.js";

const odysseyVoyager = {
  id: "family-class-1",
  vehicleFamilyId: "family-odyssey",
  travelClassId: "class-voyager",
  capacity: 24,
};

describe("createVehicleFamilyTravelClass", () => {
  it("accepts a positive capacity", () => {
    const capacity = createVehicleFamilyTravelClass(odysseyVoyager);

    assert.equal(capacity.capacity, 24);
    assert.equal(capacity.vehicleFamilyId, "family-odyssey");
    assert.equal(capacity.travelClassId, "class-voyager");
  });

  it("rejects capacity that is not greater than zero", () => {
    assert.throws(
      () => createVehicleFamilyTravelClass({ ...odysseyVoyager, capacity: 0 }),
      DomainInvariantError,
    );
    assert.throws(
      () =>
        createVehicleFamilyTravelClass({ ...odysseyVoyager, capacity: -1 }),
      DomainInvariantError,
    );
  });

  it("rejects a fractional capacity", () => {
    assert.throws(
      () =>
        createVehicleFamilyTravelClass({ ...odysseyVoyager, capacity: 1.5 }),
      DomainInvariantError,
    );
  });
});
