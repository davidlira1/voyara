import type { IncomingMessage } from "node:http";
import type { FlightSearchCriteria } from "../application/flights/flight-search-criteria.js";
import type {
  FlightAvailability,
  FlightSearchResult,
} from "../application/flights/flight-read-model.js";
import type { BookingRequest } from "../application/reservations/booking-request.js";
import type { ReservationConfirmation } from "../application/reservations/reservation-confirmation.js";
import type { ReservationDetails } from "../application/reservations/reservation-details.js";
import type { VoyageSummary } from "../application/voyages/voyage-read-model.js";
import type { Money } from "../domain/shared/money.js";
import { clientError } from "./errors.js";

export const MAX_JSON_BODY_BYTES = 16 * 1024;

const isoInstant =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const searchParameters = new Set([
  "voyageCode",
  "departureFrom",
  "departureTo",
  "travelClassCode",
  "passengerCount",
  "limit",
]);

export function serializeVoyage(voyage: VoyageSummary): {
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  baseFare: { amountMinor: number; currency: string };
} {
  return {
    code: voyage.code,
    name: voyage.name,
    description: voyage.description,
    durationMinutes: voyage.durationMinutes,
    baseFare: serializeMoney(voyage.baseFare),
  };
}

export function serializeFlight(flight: FlightSearchResult): {
  flightNumber: string;
  departureAt: string;
  returnAt: string;
  status: string;
  voyage: { code: string; name: string };
  spacecraft: {
    code: string;
    name: string;
    familyCode: string;
    familyName: string;
  };
  classes: Array<{
    code: string;
    name: string;
    farePerPassenger: { amountMinor: number; currency: string };
    availableCount: number;
  }>;
} {
  return {
    flightNumber: flight.flightNumber,
    departureAt: flight.departureAt.toISOString(),
    returnAt: flight.returnAt.toISOString(),
    status: flight.status,
    voyage: {
      code: flight.voyage.code,
      name: flight.voyage.name,
    },
    spacecraft: {
      code: flight.spacecraft.code,
      name: flight.spacecraft.name,
      familyCode: flight.spacecraft.familyCode,
      familyName: flight.spacecraft.familyName,
    },
    classes: flight.classes.map((travelClass) => ({
      code: travelClass.code,
      name: travelClass.name,
      farePerPassenger: serializeMoney(travelClass.farePerPassenger),
      availableCount: travelClass.availableCount,
    })),
  };
}

export function serializeAvailability(availability: FlightAvailability): {
  flightNumber: string;
  classes: Array<{
    code: string;
    name: string;
    farePerPassenger: { amountMinor: number; currency: string };
    availableCount: number;
    totalCount: number;
    availableAccommodationCodes: string[];
  }>;
} {
  return {
    flightNumber: availability.flightNumber,
    classes: availability.classes.map((travelClass) => ({
      code: travelClass.code,
      name: travelClass.name,
      farePerPassenger: serializeMoney(travelClass.farePerPassenger),
      availableCount: travelClass.availableCount,
      totalCount: travelClass.totalCount,
      availableAccommodationCodes: [...travelClass.availableAccommodationCodes],
    })),
  };
}

export function serializeConfirmation(confirmation: ReservationConfirmation): {
  confirmationCode: string;
  status: "CONFIRMED";
  flightNumber: string;
  departureAt: string;
  returnAt: string;
  voyage: { code: string; name: string };
  travelClass: { code: string; name: string };
  passengers: Array<{
    firstName: string;
    lastName: string;
    accommodationCode: string;
    fare: { amountMinor: number; currency: string };
  }>;
  totalPrice: { amountMinor: number; currency: string };
} {
  return {
    confirmationCode: confirmation.confirmationCode,
    status: confirmation.status,
    flightNumber: confirmation.flightNumber,
    departureAt: confirmation.departureAt.toISOString(),
    returnAt: confirmation.returnAt.toISOString(),
    voyage: {
      code: confirmation.voyage.code,
      name: confirmation.voyage.name,
    },
    travelClass: {
      code: confirmation.travelClass.code,
      name: confirmation.travelClass.name,
    },
    passengers: confirmation.passengers.map((passenger) => ({
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      accommodationCode: passenger.accommodationCode,
      fare: serializeMoney(passenger.fare),
    })),
    totalPrice: serializeMoney(confirmation.totalPrice),
  };
}

export function serializeReservation(reservation: ReservationDetails): {
  confirmationCode: string;
  status: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  flight: {
    flightNumber: string;
    departureAt: string;
    returnAt: string;
    status: string;
  };
  voyage: { code: string; name: string };
  travelClass: { code: string; name: string };
  passengers: Array<{
    firstName: string;
    lastName: string;
    accommodationCode: string;
    fare: { amountMinor: number; currency: string };
  }>;
  totalPrice: { amountMinor: number; currency: string };
  createdAt: string;
  updatedAt: string;
} {
  return {
    confirmationCode: reservation.confirmationCode,
    status: reservation.status,
    customer: {
      firstName: reservation.customer.firstName,
      lastName: reservation.customer.lastName,
      email: reservation.customer.email,
      phone: reservation.customer.phone,
    },
    flight: {
      flightNumber: reservation.flight.flightNumber,
      departureAt: reservation.flight.departureAt.toISOString(),
      returnAt: reservation.flight.returnAt.toISOString(),
      status: reservation.flight.status,
    },
    voyage: {
      code: reservation.voyage.code,
      name: reservation.voyage.name,
    },
    travelClass: {
      code: reservation.travelClass.code,
      name: reservation.travelClass.name,
    },
    passengers: reservation.passengers.map((passenger) => ({
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      accommodationCode: passenger.accommodationCode,
      fare: serializeMoney(passenger.fare),
    })),
    totalPrice: serializeMoney(reservation.totalPrice),
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}

export function parseFlightSearchQuery(
  searchParams: URLSearchParams,
): FlightSearchCriteria {
  const seen = new Set<string>();

  for (const key of searchParams.keys()) {
    if (seen.has(key) || !searchParameters.has(key) || searchParams.getAll(key).length !== 1) {
      throw clientError("INVALID_SEARCH_CRITERIA");
    }

    seen.add(key);
  }

  const criteria: {
    voyageCode?: string;
    departureFrom?: Date;
    departureTo?: Date;
    travelClassCode?: string;
    passengerCount?: number;
    limit?: number;
  } = {};
  const voyageCode = searchParams.get("voyageCode");
  const departureFrom = searchParams.get("departureFrom");
  const departureTo = searchParams.get("departureTo");
  const travelClassCode = searchParams.get("travelClassCode");
  const passengerCount = searchParams.get("passengerCount");
  const limit = searchParams.get("limit");

  if (voyageCode !== null) {
    criteria.voyageCode = voyageCode;
  }

  if (departureFrom !== null) {
    criteria.departureFrom = parseInstant(departureFrom);
  }

  if (departureTo !== null) {
    criteria.departureTo = parseInstant(departureTo);
  }

  if (travelClassCode !== null) {
    criteria.travelClassCode = travelClassCode;
  }

  if (passengerCount !== null) {
    criteria.passengerCount = parseCanonicalInteger(passengerCount);
  }

  if (limit !== null) {
    criteria.limit = parseCanonicalInteger(limit);
  }

  return criteria;
}

export function parseNovaMessage(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw clientError("INVALID_NOVA_MESSAGE");
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);

  if (
    keys.length !== 1 ||
    !Object.hasOwn(body, "message") ||
    typeof body.message !== "string"
  ) {
    throw clientError("INVALID_NOVA_MESSAGE");
  }

  return body.message;
}

export function parseBookingBody(value: unknown): BookingRequest {
  const body = plainObject(value);
  requireExactKeys(body, [
    "flightNumber",
    "travelClassCode",
    "customer",
    "passengers",
  ]);
  const customer = plainObject(body.customer);
  requireExactKeys(customer, ["firstName", "lastName", "email", "phone"]);
  if (!Array.isArray(body.passengers)) {
    throw clientError("INVALID_BOOKING");
  }

  return {
    flightNumber: requiredString(body.flightNumber),
    travelClassCode: requiredString(body.travelClassCode),
    customer: {
      firstName: requiredString(customer.firstName),
      lastName: requiredString(customer.lastName),
      email: requiredString(customer.email),
      phone: requiredString(customer.phone),
    },
    passengers: body.passengers.map((passenger) => {
      const record = plainObject(passenger);
      requireExactKeys(record, ["firstName", "lastName"]);
      return {
        firstName: requiredString(record.firstName),
        lastName: requiredString(record.lastName),
      };
    }),
  };
}

export function parseCancelBody(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw clientError("INVALID_BODY");
  }

  if (Object.keys(value).length !== 0) {
    throw clientError("INVALID_BODY");
  }
}

export async function readRequestBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  const declared = request.headers["content-length"];

  if (typeof declared === "string" && /^[0-9]+$/.test(declared)) {
    const length = Number(declared);

    if (Number.isSafeInteger(length) && length > maxBytes) {
      throw clientError("PAYLOAD_TOO_LARGE");
    }
  }

  const chunks: Buffer[] = [];
  let received = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;

    if (received > maxBytes) {
      throw clientError("PAYLOAD_TOO_LARGE");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export function parseJsonBody(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw clientError("INVALID_JSON");
  }
}

export function acceptsJson(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return false;
  }

  const [type, ...parameters] = contentType
    .split(";")
    .map((part) => part.trim().toLowerCase());

  if (type !== "application/json") {
    return false;
  }

  return parameters.every((parameter) => parameter === "charset=utf-8");
}

function serializeMoney(money: Money): {
  amountMinor: number;
  currency: string;
} {
  return {
    amountMinor: money.amountMinor,
    currency: money.currency,
  };
}

function parseInstant(value: string): Date {
  const match = isoInstant.exec(value);
  const year = numberGroup(match, 1);
  const month = numberGroup(match, 2);
  const day = numberGroup(match, 3);
  const hour = numberGroup(match, 4);
  const minute = numberGroup(match, 5);
  const second = numberGroup(match, 6);
  const zone = match?.[8];

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    zone === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw clientError("INVALID_SEARCH_CRITERIA");
  }

  const milliseconds = readMilliseconds(match?.[7]);
  const offsetMinutes = zone === "Z" ? 0 : readOffsetMinutes(zone);
  const wallClock = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    milliseconds,
  );
  const probe = new Date(wallClock);

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    probe.getUTCSeconds() !== second ||
    probe.getUTCMilliseconds() !== milliseconds
  ) {
    throw clientError("INVALID_SEARCH_CRITERIA");
  }

  return new Date(wallClock - offsetMinutes * 60_000);
}

function numberGroup(match: RegExpExecArray | null, index: number): number | undefined {
  const text = match?.[index];

  if (text === undefined) {
    return undefined;
  }

  return Number(text);
}

function readOffsetMinutes(zone: string): number {
  const sign = zone.startsWith("+") ? 1 : -1;
  const offsetHour = Number(zone.slice(1, 3));
  const offsetMinute = Number(zone.slice(4, 6));

  if (
    !Number.isInteger(offsetHour) ||
    !Number.isInteger(offsetMinute) ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw clientError("INVALID_SEARCH_CRITERIA");
  }

  return sign * (offsetHour * 60 + offsetMinute);
}

function readMilliseconds(fraction: string | undefined): number {
  if (fraction === undefined) {
    return 0;
  }

  return Number(fraction.slice(1).padEnd(3, "0"));
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return lengths[month - 1] ?? 0;
}

function parseCanonicalInteger(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw clientError("INVALID_SEARCH_CRITERIA");
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw clientError("INVALID_SEARCH_CRITERIA");
  }

  return parsed;
}

function plainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw clientError("INVALID_BOOKING");
  }

  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value);

  if (
    actual.length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw clientError("INVALID_BOOKING");
  }
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") {
    throw clientError("INVALID_BOOKING");
  }

  return value;
}
