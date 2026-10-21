import express from "express";
import type { HttpDependencies } from "./dependencies.js";
import { clientError } from "./errors.js";
import { errorHandler } from "./error-handler.js";
import { MAX_JSON_BODY_BYTES } from "./json.js";
import { defaultHttpLog, requestLog } from "./request-log.js";
import { flightsRouter } from "./routes/flights.js";
import { healthRouter } from "./routes/health.js";
import { novaRouter } from "./routes/nova.js";
import { reservationsRouter } from "./routes/reservations.js";
import { voyagesRouter } from "./routes/voyages.js";

export function createApp(dependencies: HttpDependencies): express.Express {
  const maxBodyBytes = dependencies.maxBodyBytes ?? MAX_JSON_BODY_BYTES;
  const log = dependencies.log ?? defaultHttpLog;
  const app = express();

  app.disable("x-powered-by");
  app.set("etag", false);
  app.set("case sensitive routing", true);
  app.set("strict routing", false);

  app.use((_request, response, next) => {
    response.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(requestLog(log));
  app.use("/health", healthRouter());
  app.use("/api/voyages", voyagesRouter(dependencies));
  app.use("/api/flights", flightsRouter(dependencies));
  app.use("/api/reservations", reservationsRouter(dependencies, maxBodyBytes));
  app.use("/api/nova", novaRouter(dependencies, maxBodyBytes));
  app.use((_request, _response, next) => {
    next(clientError("ROUTE_NOT_FOUND"));
  });
  app.use(errorHandler(log));

  return app;
}
