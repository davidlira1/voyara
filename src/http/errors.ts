import { CancellationNotAllowedError } from "../application/errors.js";
import { FlightNotBookableError } from "../application/errors.js";
import { FlightNotFoundError } from "../application/errors.js";
import { InsufficientAvailabilityError } from "../application/errors.js";
import { InvalidBookingError } from "../application/errors.js";
import { InvalidNovaMessageError } from "../application/errors.js";
import { InvalidReservationError } from "../application/errors.js";
import { InvalidSearchCriteriaError } from "../application/errors.js";
import { NovaTimeoutError } from "../application/errors.js";
import { NovaUnavailableError } from "../application/errors.js";
import { ReservationNotFoundError } from "../application/errors.js";
import { UnsupportedTravelClassError } from "../application/errors.js";
import { VoyageNotFoundError } from "../application/errors.js";

const clientMessages = {
  INVALID_JSON: "Request body must be valid JSON.",
  INVALID_BODY: "Request body is invalid.",
  INVALID_PATH: "Request path is invalid.",
  INVALID_SEARCH_CRITERIA: "Search criteria are invalid.",
  INVALID_BOOKING: "Booking request is invalid.",
  INVALID_RESERVATION: "Confirmation code is invalid.",
  UNAUTHORIZED: "Access denied.",
  VOYAGE_NOT_FOUND: "Voyage was not found.",
  FLIGHT_NOT_FOUND: "Flight was not found.",
  RESERVATION_NOT_FOUND: "Reservation was not found.",
  ROUTE_NOT_FOUND: "Route was not found.",
  METHOD_NOT_ALLOWED: "Method is not allowed.",
  FLIGHT_NOT_BOOKABLE: "Flight is not bookable.",
  UNSUPPORTED_TRAVEL_CLASS: "Travel class is not available on this flight.",
  INSUFFICIENT_AVAILABILITY: "Not enough accommodations are available.",
  CANCELLATION_NOT_ALLOWED: "Reservation cannot be cancelled.",
  PAYLOAD_TOO_LARGE: "Request body is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Content type is not supported.",
  INVALID_NOVA_MESSAGE: "Message is invalid.",
  NOVA_UNAVAILABLE: "Nova is unavailable.",
  NOVA_TIMEOUT: "Nova took too long to respond.",
  INTERNAL_ERROR: "Unexpected server failure.",
} as const;

const clientStatuses = {
  INVALID_JSON: 400,
  INVALID_BODY: 400,
  INVALID_PATH: 400,
  INVALID_SEARCH_CRITERIA: 400,
  INVALID_BOOKING: 400,
  INVALID_RESERVATION: 400,
  UNAUTHORIZED: 401,
  VOYAGE_NOT_FOUND: 404,
  FLIGHT_NOT_FOUND: 404,
  RESERVATION_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  FLIGHT_NOT_BOOKABLE: 409,
  UNSUPPORTED_TRAVEL_CLASS: 409,
  INSUFFICIENT_AVAILABILITY: 409,
  CANCELLATION_NOT_ALLOWED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_NOVA_MESSAGE: 400,
  NOVA_UNAVAILABLE: 502,
  NOVA_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

export type ClientErrorCode = keyof typeof clientMessages;

export class HttpError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;

  constructor(code: ClientErrorCode) {
    super(clientMessages[code]);
    this.name = "HttpError";
    this.code = code;
    this.status = clientStatuses[code];
  }
}

export function clientError(code: ClientErrorCode): HttpError {
  return new HttpError(code);
}

export class MethodNotAllowedError extends HttpError {
  readonly allow: string;

  constructor(allow: readonly string[]) {
    super("METHOD_NOT_ALLOWED");
    this.allow = [...allow].sort().join(", ");
  }
}

export function clientErrorBody(error: HttpError): {
  error: { code: ClientErrorCode; message: string };
} {
  return {
    error: {
      code: error.code,
      message: clientMessages[error.code],
    },
  };
}

export function toClientError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof InvalidSearchCriteriaError) {
    return clientError("INVALID_SEARCH_CRITERIA");
  }

  if (error instanceof InvalidBookingError) {
    return clientError("INVALID_BOOKING");
  }

  if (error instanceof InvalidReservationError) {
    return clientError("INVALID_RESERVATION");
  }

  if (error instanceof VoyageNotFoundError) {
    return clientError("VOYAGE_NOT_FOUND");
  }

  if (error instanceof FlightNotFoundError) {
    return clientError("FLIGHT_NOT_FOUND");
  }

  if (error instanceof ReservationNotFoundError) {
    return clientError("RESERVATION_NOT_FOUND");
  }

  if (error instanceof FlightNotBookableError) {
    return clientError("FLIGHT_NOT_BOOKABLE");
  }

  if (error instanceof UnsupportedTravelClassError) {
    return clientError("UNSUPPORTED_TRAVEL_CLASS");
  }

  if (error instanceof InsufficientAvailabilityError) {
    return clientError("INSUFFICIENT_AVAILABILITY");
  }

  if (error instanceof CancellationNotAllowedError) {
    return clientError("CANCELLATION_NOT_ALLOWED");
  }

  if (error instanceof InvalidNovaMessageError) {
    return clientError("INVALID_NOVA_MESSAGE");
  }

  if (error instanceof NovaUnavailableError) {
    return clientError("NOVA_UNAVAILABLE");
  }

  if (error instanceof NovaTimeoutError) {
    return clientError("NOVA_TIMEOUT");
  }

  return clientError("INTERNAL_ERROR");
}
