import { Router } from "express";
import {
  getFlight,
  getFlightAvailability,
  searchFlights,
} from "../../application/flights/flight-queries.js";
import type { HttpDependencies } from "../dependencies.js";
import { clientError } from "../errors.js";
import {
  parseFlightSearchQuery,
  serializeAvailability,
  serializeFlight,
} from "../json.js";
import { methodNotAllowed, routeContext } from "../route-middleware.js";

export function flightsRouter(dependencies: HttpDependencies): Router {
  const router = Router({ caseSensitive: true });
  const listContext = routeContext("/api/flights", false);
  const availabilityContext = routeContext(
    "/api/flights/:flightNumber/availability",
    false,
  );
  const detailContext = routeContext("/api/flights/:flightNumber", false);

  router
    .route("/")
    .head(listContext, methodNotAllowed(["GET"]))
    .get(listContext, async (request, response) => {
      const flights = await searchFlights(
        dependencies.flights,
        parseFlightSearchQuery(searchParams(request.originalUrl)),
        dependencies.clock,
      );
      response.json({ flights: flights.map(serializeFlight) });
    })
    .all(listContext, methodNotAllowed(["GET"]));

  router
    .route("/:flightNumber/availability")
    .head(availabilityContext, methodNotAllowed(["GET"]))
    .get(availabilityContext, async (request, response) => {
      response.json(
        serializeAvailability(
          await getFlightAvailability(
            dependencies.flights,
            pathParam(request.params.flightNumber),
          ),
        ),
      );
    })
    .all(availabilityContext, methodNotAllowed(["GET"]));

  router
    .route("/:flightNumber")
    .head(detailContext, methodNotAllowed(["GET"]))
    .get(detailContext, async (request, response) => {
      response.json(
        serializeFlight(
          await getFlight(
            dependencies.flights,
            pathParam(request.params.flightNumber),
          ),
        ),
      );
    })
    .all(detailContext, methodNotAllowed(["GET"]));

  return router;
}

function searchParams(originalUrl: string): URLSearchParams {
  return new URL(originalUrl, "http://127.0.0.1").searchParams;
}

function pathParam(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw clientError("INVALID_PATH");
  }

  return value;
}
