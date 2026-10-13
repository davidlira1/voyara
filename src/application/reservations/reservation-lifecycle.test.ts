import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CancellationNotAllowedError,
  InvalidReservationError,
} from "../errors.js";
import type { ReservationFacts } from "../ports/reservation-query-repository.js";
import type {
  LockedReservation,
  ReservationCancellation,
} from "../ports/reservation-cancellation.js";
import { cancelReservation } from "./cancel-reservation.js";
import { getReservation } from "./get-reservation.js";

const asOf = new Date("2026-10-07T00:00:00.000Z");
const clock = { now: () => new Date(asOf) };

describe("reservation lifecycle decisions", () => {
  it("rejects a blank confirmation code before opening a transaction", async () => {
    await assert.rejects(
      () => getReservation("   ", unusedQuery()),
      InvalidReservationError,
    );
    await assert.rejects(
      () =>
        cancelReservation("   ", {
          cancellations: failIfOpened(),
          clock,
        }),
      InvalidReservationError,
    );
  });

  it("returns a cancelled reservation without writing", async () => {
    let writes = 0;
    const result = await cancelReservation("VYCANCEL1", {
      cancellations: cancellationOf(facts({ status: "CANCELLED" }), () => {
        writes += 1;
      }),
      clock,
    });

    assert.equal(writes, 0);
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.updatedAt.toISOString(), "2026-09-01T00:00:00.000Z");
  });

  it("cancels a confirmed reservation only after the row is locked", async () => {
    const writes: Date[] = [];
    const result = await cancelReservation("VYCONFIRM", {
      cancellations: cancellationOf(facts({ status: "CONFIRMED" }), (updatedAt) => {
        writes.push(updatedAt);
      }),
      clock,
    });

    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.toISOString(), asOf.toISOString());
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.updatedAt.toISOString(), asOf.toISOString());
    assert.equal(result.totalPrice.amountMinor, 120_000);
    assert.equal(result.passengers[0]?.fare.amountMinor, 120_000);
  });

  it("rejects completed and departed reservations without writing", async () => {
    let writes = 0;
    const cancellations = cancellationOf(facts({ status: "COMPLETED" }), () => {
      writes += 1;
    });

    await assert.rejects(
      () => cancelReservation("VYDONE", { cancellations, clock }),
      CancellationNotAllowedError,
    );

    const departed = cancellationOf(
      facts({
        status: "CONFIRMED",
        departureAt: new Date("2026-10-01T00:00:00.000Z"),
      }),
      () => {
        writes += 1;
      },
    );
    await assert.rejects(
      () => cancelReservation("VYPAST", { cancellations: departed, clock }),
      CancellationNotAllowedError,
    );
    assert.equal(writes, 0);
  });
});

function facts(overrides: Partial<ReservationFacts>): ReservationFacts {
  return {
    confirmationCode: "VYCONFIRM",
    status: "CONFIRMED",
    customerFirstName: "Ada",
    customerLastName: "Booker",
    customerEmail: "ada.booker@example.test",
    customerPhone: "+1-555-0100",
    flightNumber: "VY-1001",
    departureAt: new Date("2026-10-08T09:00:00.000Z"),
    returnAt: new Date("2026-10-08T13:00:00.000Z"),
    flightStatus: "SCHEDULED",
    voyageCode: "ORB-01",
    voyageName: "Earthlight",
    travelClassCode: "VOYAGER",
    travelClassName: "Voyager",
    passengers: [
      {
        firstName: "Ada",
        lastName: "Booker",
        accommodationCode: "V01",
        fareAmountMinor: 120_000,
      },
    ],
    totalPriceAmountMinor: 120_000,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

function cancellationOf(
  details: ReservationFacts,
  onMark: (updatedAt: Date) => void,
): ReservationCancellation {
  return {
    async transact(work) {
      const locked: LockedReservation = { id: "reservation-1", details };
      return work({
        async lockByConfirmationCode() {
          return locked;
        },
        async markCancelled(_id, updatedAt) {
          onMark(updatedAt);
        },
      });
    },
  };
}

function unusedQuery() {
  return {
    async findByConfirmationCode() {
      throw new Error("Lookup should happen after validation.");
    },
  };
}

function failIfOpened(): ReservationCancellation {
  return {
    async transact() {
      throw new Error("Validation should happen before the transaction.");
    },
  };
}
