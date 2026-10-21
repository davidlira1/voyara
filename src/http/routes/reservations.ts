import { Router } from "express";
import { cancelReservation } from "../../application/reservations/cancel-reservation.js";
import { createConfirmedReservation } from "../../application/reservations/create-confirmed-reservation.js";
import { getReservation } from "../../application/reservations/get-reservation.js";
import type { HttpDependencies } from "../dependencies.js";
import { clientError } from "../errors.js";
import {
  parseBookingBody,
  serializeConfirmation,
  serializeReservation,
} from "../json.js";
import {
  methodNotAllowed,
  parseJsonBody,
  parseOptionalJson,
  requireDevAccess,
  routeContext,
} from "../route-middleware.js";

export function reservationsRouter(
  dependencies: HttpDependencies,
  maxBodyBytes: number,
): Router {
  const router = Router({ caseSensitive: true });
  const authenticate = requireDevAccess(dependencies.devAccessToken);
  const createContext = routeContext("/api/reservations", true);
  const cancelContext = routeContext(
    "/api/reservations/:confirmationCode/cancel",
    true,
  );
  const detailContext = routeContext(
    "/api/reservations/:confirmationCode",
    true,
  );

  router
    .route("/")
    .post(
      createContext,
      authenticate,
      parseJsonBody(maxBodyBytes),
      async (request, response) => {
        const confirmation = await createConfirmedReservation(
          parseBookingBody(request.body),
          {
            bookings: dependencies.bookings,
            ids: dependencies.ids,
            clock: dependencies.clock,
          },
        );
        response.status(201).json(serializeConfirmation(confirmation));
      },
    )
    .all(createContext, methodNotAllowed(["POST"]));

  router
    .route("/:confirmationCode/cancel")
    .post(
      cancelContext,
      authenticate,
      parseOptionalJson(maxBodyBytes),
      async (request, response) => {
        response.json(
          serializeReservation(
            await cancelReservation(pathParam(request.params.confirmationCode), {
              cancellations: dependencies.cancellations,
              clock: dependencies.clock,
            }),
          ),
        );
      },
    )
    .all(cancelContext, methodNotAllowed(["POST"]));

  router
    .route("/:confirmationCode")
    .head(detailContext, methodNotAllowed(["GET"]))
    .get(detailContext, authenticate, async (request, response) => {
      response.json(
        serializeReservation(
          await getReservation(
            pathParam(request.params.confirmationCode),
            dependencies.reservations,
          ),
        ),
      );
    })
    .all(detailContext, methodNotAllowed(["GET"]));

  return router;
}

function pathParam(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw clientError("INVALID_PATH");
  }

  return value;
}
