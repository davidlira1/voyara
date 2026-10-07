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
