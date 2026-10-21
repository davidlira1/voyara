import type { ErrorRequestHandler } from "express";
import type { HttpLog } from "./dependencies.js";
import {
  clientError,
  clientErrorBody,
  MethodNotAllowedError,
  toClientError,
} from "./errors.js";

export function errorHandler(log: HttpLog): ErrorRequestHandler {
  return (error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const client = mapTransportError(error);
    const template = response.locals.routeTemplate;
    const route = typeof template === "string" ? template : "unmatched";

    if (client.status >= 500) {
      log.failure({
        route,
        errorName: error instanceof Error ? error.name : "Error",
      });
    }

    if (client instanceof MethodNotAllowedError) {
      response.set("Allow", client.allow);
    }

    if (response.locals.sensitive === true) {
      response.set("Cache-Control", "no-store");
    }

    response.status(client.status).json(clientErrorBody(client));
  };
}

function mapTransportError(error: unknown) {
  const type = parserType(error);

  if (type === "entity.parse.failed") {
    return clientError("INVALID_JSON");
  }

  if (type === "entity.too.large") {
    return clientError("PAYLOAD_TOO_LARGE");
  }

  if (error instanceof URIError) {
    return clientError("INVALID_PATH");
  }

  return toClientError(error);
}

function parserType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }

  return typeof error.type === "string" ? error.type : undefined;
}
