import { InvalidBookingError } from "../errors.js";

export type BookingRequest = {
  readonly flightNumber: string;
  readonly travelClassCode: string;
  readonly customer: {
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly phone: string;
  };
  readonly passengers: readonly {
    readonly firstName: string;
    readonly lastName: string;
  }[];
};

export type NormalizedBookingRequest = {
  readonly flightNumber: string;
  readonly travelClassCode: string;
  readonly customer: {
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
    readonly phone: string;
  };
  readonly passengers: readonly {
    readonly firstName: string;
    readonly lastName: string;
  }[];
};

export function normalizeBookingRequest(
  request: BookingRequest,
): NormalizedBookingRequest {
  if (request.passengers.length === 0) {
    throw new InvalidBookingError("At least one passenger is required.");
  }

  return {
    flightNumber: requiredText(request.flightNumber, "Flight number"),
    travelClassCode: requiredText(request.travelClassCode, "Travel class code"),
    customer: {
      firstName: requiredText(request.customer.firstName, "Customer first name"),
      lastName: requiredText(request.customer.lastName, "Customer last name"),
      email: requiredText(request.customer.email, "Customer email"),
      phone: requiredText(request.customer.phone, "Customer phone"),
    },
    passengers: request.passengers.map((passenger, index) => ({
      firstName: requiredText(
        passenger.firstName,
        `Passenger ${index + 1} first name`,
      ),
      lastName: requiredText(
        passenger.lastName,
        `Passenger ${index + 1} last name`,
      ),
    })),
  };
}

function requiredText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidBookingError(`${label} must not be blank.`);
  }

  return value.trim();
}
