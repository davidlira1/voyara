import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Clock } from "../application/clock.js";
import { chatWithNova } from "../application/nova/chat-with-nova.js";
import type { LanguageModel } from "../application/ports/language-model.js";
import { getFlight, getFlightAvailability, searchFlights } from "../application/flights/flight-queries.js";
import type { FlightQueryRepository } from "../application/ports/flight-query-repository.js";
import type { IdGenerator } from "../application/ports/id-generator.js";
import type { ReservationBooking } from "../application/ports/reservation-booking.js";
import type { ReservationCancellation } from "../application/ports/reservation-cancellation.js";
import type { ReservationQueryRepository } from "../application/ports/reservation-query-repository.js";
import type { VoyageQueryRepository } from "../application/ports/voyage-query-repository.js";
import { cancelReservation } from "../application/reservations/cancel-reservation.js";
import { createConfirmedReservation } from "../application/reservations/create-confirmed-reservation.js";
import { getReservation } from "../application/reservations/get-reservation.js";
import { getVoyage, listVoyages } from "../application/voyages/voyage-queries.js";
import { authorizeDevAccess } from "./auth.js";
import { clientError, clientErrorBody, toClientError } from "./errors.js";
import {
  MAX_JSON_BODY_BYTES,
  acceptsJson,
  parseBookingBody,
  parseCancelBody,
  parseFlightSearchQuery,
  parseJsonBody,
  parseNovaMessage,
  readRequestBody,
  serializeAvailability,
  serializeConfirmation,
  serializeFlight,
  serializeReservation,
  serializeVoyage,
} from "./json.js";
import { compileRoute, matchRoute, type HttpRoute } from "./router.js";

export type HttpLog = {
  access(entry: {
    method: string;
    route: string;
    status: number;
  }): void;
  failure(entry: { route: string; errorName: string }): void;
};

export type HttpDependencies = {
  readonly voyages: VoyageQueryRepository;
  readonly flights: FlightQueryRepository;
  readonly bookings: ReservationBooking;
  readonly reservations: ReservationQueryRepository;
  readonly cancellations: ReservationCancellation;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly devAccessToken: string;
  readonly languageModel: LanguageModel;
  readonly maxBodyBytes?: number;
  readonly log?: HttpLog;
};

const routes: readonly HttpRoute[] = [
  compileRoute("GET", "/health", { authenticate: false, sensitive: false }),
  compileRoute("GET", "/api/voyages", { authenticate: false, sensitive: false }),
  compileRoute("GET", "/api/voyages/:code", {
    authenticate: false,
    sensitive: false,
  }),
  compileRoute("GET", "/api/flights", { authenticate: false, sensitive: false }),
  compileRoute("GET", "/api/flights/:flightNumber", {
    authenticate: false,
    sensitive: false,
  }),
  compileRoute("GET", "/api/flights/:flightNumber/availability", {
    authenticate: false,
    sensitive: false,
  }),
  compileRoute("POST", "/api/reservations", {
    authenticate: true,
    sensitive: true,
  }),
  compileRoute("GET", "/api/reservations/:confirmationCode", {
    authenticate: true,
    sensitive: true,
  }),
  compileRoute("POST", "/api/reservations/:confirmationCode/cancel", {
    authenticate: true,
    sensitive: true,
  }),
  compileRoute("POST", "/api/nova/chat", {
    authenticate: true,
    sensitive: true,
  }),
];

const defaultLog: HttpLog = {
  access(entry) {
    console.info(JSON.stringify({ level: "info", ...entry }));
  },
  failure(entry) {
    console.error(JSON.stringify({ level: "error", ...entry }));
  },
};

export function createHttpServer(dependencies: HttpDependencies): Server {
  const maxBodyBytes = dependencies.maxBodyBytes ?? MAX_JSON_BODY_BYTES;
  const log = dependencies.log ?? defaultLog;

  return createServer((request, response) => {
    void dispatch(request, response, dependencies, maxBodyBytes, log).catch(() => {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      writeJson(
        response,
        500,
        clientErrorBody(clientError("INTERNAL_ERROR")),
        false,
      );
    });
  });
}

export function listen(server: Server, host = "127.0.0.1"): Promise<URL> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.removeListener("error", reject);
      const address = server.address();

      if (address === null || typeof address === "string") {
        reject(new Error("HTTP server did not bind to a TCP port."));
        return;
      }

      resolve(new URL(`http://127.0.0.1:${address.port}`));
    });
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function dispatch(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: HttpDependencies,
  maxBodyBytes: number,
  log: HttpLog,
): Promise<void> {
  const method = request.method ?? "GET";
  let route = "unmatched";
  let sensitive = false;
  let status = 500;

  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const matched = matchRoute(routes, method, url.pathname);

    if (matched.kind === "not_found") {
      throw clientError("ROUTE_NOT_FOUND");
    }

    if (matched.kind === "method_not_allowed") {
      route = matched.template;
      sensitive = matched.sensitive;
      status = 405;
      writeJson(
        response,
        status,
        clientErrorBody(clientError("METHOD_NOT_ALLOWED")),
        sensitive,
        { allow: matched.allow.join(", ") },
      );
      return;
    }

    route = matched.route.template;
    sensitive = matched.route.sensitive;

    if (
      matched.route.authenticate &&
      !authorizeDevAccess(request.headers.authorization, dependencies.devAccessToken)
    ) {
      throw clientError("UNAUTHORIZED");
    }

    const body = await handle(
      matched.route.template,
      matched.params,
      url,
      request,
      dependencies,
      maxBodyBytes,
    );
    status = matched.route.method === "POST" && matched.route.template === "/api/reservations"
      ? 201
      : 200;
    writeJson(response, status, body, sensitive);
  } catch (error) {
    const client = toClientError(error);
    status = client.status;

    if (client.status >= 500) {
      log.failure({
        route,
        errorName: error instanceof Error ? error.name : "Error",
      });
    }

    if (!response.headersSent) {
      writeJson(response, client.status, clientErrorBody(client), sensitive);
    }

    request.resume();
  } finally {
    log.access({ method, route, status });
  }
}

async function handle(
  template: string,
  params: Readonly<Record<string, string>>,
  url: URL,
  request: IncomingMessage,
  dependencies: HttpDependencies,
  maxBodyBytes: number,
): Promise<unknown> {
  switch (template) {
    case "/health":
      return { status: "ok" };
    case "/api/voyages":
      return {
        voyages: (await listVoyages(dependencies.voyages)).map(serializeVoyage),
      };
    case "/api/voyages/:code":
      return serializeVoyage(
        await getVoyage(dependencies.voyages, requiredParam(params, "code")),
      );
    case "/api/flights":
      return {
        flights: (
          await searchFlights(
            dependencies.flights,
            parseFlightSearchQuery(url.searchParams),
            dependencies.clock,
          )
        ).map(serializeFlight),
      };
    case "/api/flights/:flightNumber":
      return serializeFlight(
        await getFlight(
          dependencies.flights,
          requiredParam(params, "flightNumber"),
        ),
      );
    case "/api/flights/:flightNumber/availability":
      return serializeAvailability(
        await getFlightAvailability(
          dependencies.flights,
          requiredParam(params, "flightNumber"),
        ),
      );
    case "/api/reservations":
      return serializeConfirmation(
        await createConfirmedReservation(
          parseBookingBody(
            await readJson(request, maxBodyBytes, { required: true }),
          ),
          {
            bookings: dependencies.bookings,
            ids: dependencies.ids,
            clock: dependencies.clock,
          },
        ),
      );
    case "/api/reservations/:confirmationCode":
      return serializeReservation(
        await getReservation(
          requiredParam(params, "confirmationCode"),
          dependencies.reservations,
        ),
      );
    case "/api/reservations/:confirmationCode/cancel":
      await readCancelBody(request, maxBodyBytes);
      return serializeReservation(
        await cancelReservation(requiredParam(params, "confirmationCode"), {
          cancellations: dependencies.cancellations,
          clock: dependencies.clock,
        }),
      );
    case "/api/nova/chat":
      return chatWithNova(
        parseNovaMessage(await readJson(request, maxBodyBytes, { required: true })),
        { model: dependencies.languageModel },
      );
    default:
      throw clientError("ROUTE_NOT_FOUND");
  }
}

async function readJson(
  request: IncomingMessage,
  maxBodyBytes: number,
  options: { required: boolean },
): Promise<unknown> {
  if (!acceptsJson(request.headers["content-type"])) {
    throw clientError("UNSUPPORTED_MEDIA_TYPE");
  }

  const bytes = await readRequestBody(request, maxBodyBytes);

  if (!options.required && bytes.length === 0) {
    return {};
  }

  return parseJsonBody(bytes);
}

async function readCancelBody(
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<void> {
  const bytes = await readRequestBody(request, maxBodyBytes);

  if (bytes.length === 0) {
    return;
  }

  if (!acceptsJson(request.headers["content-type"])) {
    throw clientError("UNSUPPORTED_MEDIA_TYPE");
  }

  parseCancelBody(parseJsonBody(bytes));
}

function requiredParam(
  params: Readonly<Record<string, string>>,
  name: string,
): string {
  const value = params[name];

  if (value === undefined) {
    throw clientError("INVALID_PATH");
  }

  return value;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  sensitive: boolean,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "x-content-type-options": "nosniff",
    ...(sensitive ? { "cache-control": "no-store" } : {}),
    ...extraHeaders,
  });
  response.end(payload);
}
