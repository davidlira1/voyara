import type { Money } from "../../domain/shared/money.js";

export type ReservationConfirmation = {
  readonly confirmationCode: string;
  readonly status: "CONFIRMED";
  readonly flightNumber: string;
  readonly departureAt: Date;
  readonly returnAt: Date;
  readonly voyage: {
    readonly code: string;
    readonly name: string;
  };
  readonly travelClass: {
    readonly code: string;
    readonly name: string;
  };
  readonly passengers: readonly {
    readonly firstName: string;
    readonly lastName: string;
    readonly accommodationCode: string;
    readonly fare: Money;
  }[];
  readonly totalPrice: Money;
};
