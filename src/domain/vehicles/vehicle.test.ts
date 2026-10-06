import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createVehicle } from "./vehicle.js";
import { VehicleStatus } from "./vehicle-status.js";

describe("createVehicle", () => {
  it("accepts an active vehicle in one family", () => {
    const vehicle = createVehicle({
      id: "vehicle-1",
      code: "ODY-02",
      name: "Odyssey-02",
      vehicleFamilyId: "family-odyssey",
      status: VehicleStatus.Active,
    });

    assert.equal(vehicle.vehicleFamilyId, "family-odyssey");
    assert.equal(vehicle.status, "ACTIVE");
  });

  it("rejects an unknown status", () => {
    assert.throws(
      () =>
        createVehicle({
          id: "vehicle-1",
          code: "ODY-02",
          name: "Odyssey-02",
          vehicleFamilyId: "family-odyssey",
          status: "GROUNDED",
        }),
      DomainInvariantError,
    );
  });
});
