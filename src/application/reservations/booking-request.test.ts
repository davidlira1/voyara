import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidBookingError } from "../errors.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { ReservationBooking } from "../ports/reservation-booking.js";
import { createConfirmedReservation } from "./create-confirmed-reservation.js";

describe("createConfirmedReservation input", () => {
  it("rejects an empty passenger list before opening a transaction", async () => {
    await assert.rejects(
      () =>
        createConfirmedReservation(validRequest({ passengers: [] }), {
          bookings: failIfOpened(),
          ids,
        }),
      InvalidBookingError,
    );
  });

  it("rejects a blank passenger name before opening a transaction", async () => {
    await assert.rejects(
      () =>
        createConfirmedReservation(
          validRequest({
            passengers: [{ firstName: "   ", lastName: "Hart" }],
          }),
          {
            bookings: failIfOpened(),
            ids,
          },
        ),
      InvalidBookingError,
    );
  });
});

function validRequest(
  overrides: Partial<{
    passengers: { firstName: string; lastName: string }[];
  }>,
) {
  return {
    flightNumber: "VY-1001",
    travelClassCode: "VOYAGER",
    customer: {
      firstName: "Dolly",
      lastName: "Hart",
      email: "dolly.hart@example.test",
      phone: "+1-555-0101",
    },
    passengers: [{ firstName: "Dolly", lastName: "Hart" }],
    ...overrides,
  };
}

const ids: IdGenerator = {
  newId: () => "00000000-0000-4000-8000-000000000001",
  newConfirmationCode: () => "VYTESTCODE",
};

function failIfOpened(): ReservationBooking {
  return {
    async transact() {
      throw new Error("Validation should happen before the transaction.");
    },
  };
}
