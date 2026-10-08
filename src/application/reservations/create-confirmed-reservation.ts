import { systemClock, type Clock } from "../clock.js";
import { createCustomer } from "../../domain/customers/customer.js";
import { createPassenger } from "../../domain/passengers/passenger.js";
import {
  createFareMultiplier,
  createMoney,
  multiplyMoney,
} from "../../domain/shared/money.js";
import { createReservationPassenger } from "../../domain/reservations/reservation-passenger.js";
import { createReservation } from "../../domain/reservations/reservation.js";
import { ReservationStatus } from "../../domain/reservations/reservation-status.js";
import {
  FlightNotBookableError,
  FlightNotFoundError,
  InsufficientAvailabilityError,
  InvalidBookingError,
  UnsupportedTravelClassError,
} from "../errors.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type {
  BookingFlight,
  ReservationBooking,
} from "../ports/reservation-booking.js";
import {
  normalizeBookingRequest,
  type BookingRequest,
} from "./booking-request.js";
import type { ReservationConfirmation } from "./reservation-confirmation.js";

const bookableStatuses = new Set(["SCHEDULED", "DELAYED"]);

export async function createConfirmedReservation(
  request: BookingRequest,
  dependencies: {
    bookings: ReservationBooking;
    ids: IdGenerator;
    clock?: Clock;
  },
): Promise<ReservationConfirmation> {
  const booking = normalizeBookingRequest(request);
  const clock = dependencies.clock ?? systemClock;
  const asOf = readClock(clock);

  return dependencies.bookings.transact(async (unit) => {
    const flight = await unit.findFlight(booking.flightNumber);

    if (flight === null) {
      throw new FlightNotFoundError(booking.flightNumber);
    }

    if (!isBookable(flight, asOf)) {
      throw new FlightNotBookableError(flight.flightNumber);
    }

    const travelClass = flight.classes.find(
      (candidate) => candidate.code === booking.travelClassCode,
    );

    if (travelClass === undefined) {
      throw new UnsupportedTravelClassError(
        flight.flightNumber,
        booking.travelClassCode,
      );
    }

    const accommodations = await unit.lockAccommodations({
      flightId: flight.id,
      travelClassId: travelClass.id,
      count: booking.passengers.length,
    });

    if (accommodations.length < booking.passengers.length) {
      throw new InsufficientAvailabilityError(
        flight.flightNumber,
        travelClass.code,
      );
    }

    const timestamp = asOf;
    const fare = multiplyMoney(
      createMoney(flight.baseFareAmountMinor),
      createFareMultiplier(travelClass.numerator, travelClass.denominator),
    );
    const totalPrice = createMoney(fare.amountMinor * booking.passengers.length);
    const customer = createCustomer({
      id: dependencies.ids.newId(),
      ...booking.customer,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const passengers = booking.passengers.map((passenger) =>
      createPassenger({
        id: dependencies.ids.newId(),
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
    const reservation = createReservation({
      id: dependencies.ids.newId(),
      confirmationCode: dependencies.ids.newConfirmationCode(),
      customerId: customer.id,
      flightId: flight.id,
      travelClassId: travelClass.id,
      status: ReservationStatus.Confirmed,
      totalPrice,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const assignments = passengers.map((passenger, index) => {
      const accommodation = accommodations[index];

      if (accommodation === undefined) {
        throw new InsufficientAvailabilityError(
          flight.flightNumber,
          travelClass.code,
        );
      }

      return createReservationPassenger({
        id: dependencies.ids.newId(),
        reservationId: reservation.id,
        passengerId: passenger.id,
        flightAccommodationId: accommodation.id,
        fare,
      });
    });
    const stored = await unit.persist({
      customer,
      passengers,
      reservation,
      assignments,
    });

    return {
      confirmationCode: stored.confirmationCode,
      status: "CONFIRMED",
      flightNumber: flight.flightNumber,
      departureAt: new Date(flight.departureAt),
      returnAt: new Date(flight.returnAt),
      voyage: {
        code: flight.voyageCode,
        name: flight.voyageName,
      },
      travelClass: {
        code: travelClass.code,
        name: travelClass.name,
      },
      passengers: passengers.map((passenger, index) => ({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        accommodationCode: accommodations[index]?.code ?? "",
        fare,
      })),
      totalPrice,
    };
  });
}

function isBookable(flight: BookingFlight, asOf: Date): boolean {
  return (
    bookableStatuses.has(flight.status) &&
    flight.departureAt.getTime() > asOf.getTime()
  );
}

function readClock(clock: Clock): Date {
  const now = clock.now();

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new InvalidBookingError("Reference time must be a valid instant.");
  }

  return new Date(now.getTime());
}
