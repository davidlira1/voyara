import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createMoney } from "../shared/money.js";
import { createReservationPassenger } from "./reservation-passenger.js";

describe("createReservationPassenger", () => {
  it("accepts a non-negative fare", () => {
    const assignment = createReservationPassenger({
      id: "reservation-passenger-1",
      reservationId: "reservation-1",
      passengerId: "passenger-1",
      flightAccommodationId: "accommodation-1",
      fare: createMoney(0),
    });

    assert.equal(assignment.fare.amountMinor, 0);
  });

  it("rejects a negative fare", () => {
    assert.throws(
      () =>
        createReservationPassenger({
          id: "reservation-passenger-1",
          reservationId: "reservation-1",
          passengerId: "passenger-1",
          flightAccommodationId: "accommodation-1",
          fare: { amountMinor: -1, currency: "USD" },
        }),
      DomainInvariantError,
    );
  });
});
