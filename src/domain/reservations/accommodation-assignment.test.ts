import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFlightAccommodation } from "../flights/flight-accommodation.js";
import { DomainInvariantError } from "../shared/domain-error.js";
import { createMoney } from "../shared/money.js";
import { assertAccommodationMatchesReservation } from "./accommodation-assignment.js";
import { createReservation } from "./reservation.js";
import { ReservationStatus } from "./reservation-status.js";

const createdAt = new Date("2087-10-01T15:00:00.000Z");

function reservationFor(flightId: string, travelClassId: string) {
  return createReservation({
    id: "reservation-1",
    confirmationCode: "VY7A2C",
    customerId: "customer-1",
    flightId,
    travelClassId,
    status: ReservationStatus.Confirmed,
    totalPrice: createMoney(1_750_000),
    createdAt,
    updatedAt: createdAt,
  });
}

function accommodationFor(flightId: string, travelClassId: string) {
  return createFlightAccommodation({
    id: "accommodation-1",
    flightId,
    travelClassId,
    code: "P01",
  });
}

describe("assertAccommodationMatchesReservation", () => {
  it("accepts an accommodation on the reservation flight and travel class", () => {
    assert.doesNotThrow(() =>
      assertAccommodationMatchesReservation(
        reservationFor("flight-1", "class-voyager-plus"),
        accommodationFor("flight-1", "class-voyager-plus"),
      ),
    );
  });

  it("rejects an accommodation from another flight", () => {
    assert.throws(
      () =>
        assertAccommodationMatchesReservation(
          reservationFor("flight-1", "class-voyager-plus"),
          accommodationFor("flight-2", "class-voyager-plus"),
        ),
      DomainInvariantError,
    );
  });

  it("rejects an accommodation from another travel class", () => {
    assert.throws(
      () =>
        assertAccommodationMatchesReservation(
          reservationFor("flight-1", "class-voyager-plus"),
          accommodationFor("flight-1", "class-celestial"),
        ),
      DomainInvariantError,
    );
  });
});
