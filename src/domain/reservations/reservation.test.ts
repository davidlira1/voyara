import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createMoney } from "../shared/money.js";
import { createReservation } from "./reservation.js";
import { ReservationStatus } from "./reservation-status.js";

const createdAt = new Date("2087-10-01T15:00:00.000Z");

const held = {
  id: "reservation-1",
  confirmationCode: "VY7A2C",
  customerId: "customer-1",
  flightId: "flight-1",
  travelClassId: "class-voyager-plus",
  status: ReservationStatus.Held,
  totalPrice: createMoney(1_750_000),
  createdAt,
  updatedAt: createdAt,
};

describe("createReservation", () => {
  it("creates a reservation for one flight and one travel class", () => {
    const reservation = createReservation(held);

    assert.equal(reservation.flightId, "flight-1");
    assert.equal(reservation.travelClassId, "class-voyager-plus");
    assert.equal(reservation.status, "HELD");
    assert.equal(reservation.totalPrice.amountMinor, 1_750_000);
  });

  it("rejects a negative total price", () => {
    assert.throws(
      () =>
        createReservation({
          ...held,
          totalPrice: { amountMinor: -1, currency: "USD" },
        }),
      DomainInvariantError,
    );
  });

  it("rejects an unknown status", () => {
    assert.throws(
      () => createReservation({ ...held, status: "EXPIRED" }),
      DomainInvariantError,
    );
  });
});
