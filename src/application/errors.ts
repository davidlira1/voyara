export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidSearchCriteriaError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

export class VoyageNotFoundError extends ApplicationError {
  constructor(code: string) {
    super(`Voyage ${code} was not found.`);
  }
}

export class FlightNotFoundError extends ApplicationError {
  constructor(flightNumber: string) {
    super(`Flight ${flightNumber} was not found.`);
  }
}

export class InvalidBookingError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

export class FlightNotBookableError extends ApplicationError {
  constructor(flightNumber: string) {
    super(`Flight ${flightNumber} is not bookable.`);
  }
}

export class UnsupportedTravelClassError extends ApplicationError {
  constructor(flightNumber: string, travelClassCode: string) {
    super(
      `Travel class ${travelClassCode} is not available on flight ${flightNumber}.`,
    );
  }
}

export class InsufficientAvailabilityError extends ApplicationError {
  constructor(flightNumber: string, travelClassCode: string) {
    super(
      `Flight ${flightNumber} does not have enough available ${travelClassCode} accommodations.`,
    );
  }
}

export class InvalidReservationError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

export class ReservationNotFoundError extends ApplicationError {
  constructor(confirmationCode: string) {
    super(`Reservation ${confirmationCode} was not found.`);
  }
}

export class CancellationNotAllowedError extends ApplicationError {
  constructor(confirmationCode: string) {
    super(`Reservation ${confirmationCode} cannot be cancelled.`);
  }
}

export class InvalidNovaMessageError extends ApplicationError {
  constructor() {
    super("Message is invalid.");
  }
}

export class NovaUnavailableError extends ApplicationError {
  constructor() {
    super("Nova is unavailable.");
  }
}

export class NovaTimeoutError extends ApplicationError {
  constructor() {
    super("Nova took too long to respond.");
  }
}
