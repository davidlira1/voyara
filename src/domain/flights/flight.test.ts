import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createFlight } from "./flight.js";
import { FlightStatus } from "./flight-status.js";

const departureAt = new Date("2087-11-12T08:30:00.000Z");
const returnAt = new Date("2087-11-14T00:30:00.000Z");

const vy482 = {
  id: "flight-1",
  flightNumber: "VY-482",
  voyageId: "voyage-1",
  vehicleId: "vehicle-1",
  departureAt,
  returnAt,
  status: FlightStatus.Scheduled,
};

describe("createFlight", () => {
  it("creates a scheduled flight when return is after departure", () => {
    const flight = createFlight(vy482);

    assert.equal(flight.flightNumber, "VY-482");
    assert.equal(flight.departureAt.toISOString(), departureAt.toISOString());
    assert.equal(flight.returnAt.toISOString(), returnAt.toISOString());
    assert.equal(flight.status, "SCHEDULED");
  });

  it("copies departure and return so the caller's dates stay independent", () => {
    const callerDeparture = new Date(departureAt);
    const flight = createFlight({ ...vy482, departureAt: callerDeparture });

    callerDeparture.setTime(callerDeparture.getTime() + 60_000);

    assert.equal(flight.departureAt.toISOString(), departureAt.toISOString());
  });

  it("rejects a return at or before departure", () => {
    assert.throws(
      () => createFlight({ ...vy482, returnAt: new Date(departureAt) }),
      DomainInvariantError,
    );
    assert.throws(
      () =>
        createFlight({
          ...vy482,
          returnAt: new Date(departureAt.getTime() - 1),
        }),
      DomainInvariantError,
    );
  });

  it("rejects an invalid departure instant", () => {
    assert.throws(
      () => createFlight({ ...vy482, departureAt: new Date("not-a-date") }),
      DomainInvariantError,
    );
  });

  it("rejects an unknown status", () => {
    assert.throws(
      () => createFlight({ ...vy482, status: "HOLDING" }),
      DomainInvariantError,
    );
  });
});
