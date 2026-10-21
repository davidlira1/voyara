import express from "express";
import { authorizeDevAccess } from "./auth.js";
import { clientError, MethodNotAllowedError } from "./errors.js";
import { acceptsJson, parseCancelBody } from "./json.js";

export function routeContext(
  template: string,
  sensitive: boolean,
): express.RequestHandler {
  return (_request, response, next) => {
    response.locals.routeTemplate = template;
    response.locals.sensitive = sensitive;

    if (sensitive) {
      response.set("Cache-Control", "no-store");
    }

    next();
  };
}

export function requireDevAccess(token: string): express.RequestHandler {
  return (request, _response, next) => {
    if (!authorizeDevAccess(headerValue(request, "authorization"), token)) {
      next(clientError("UNAUTHORIZED"));
      return;
    }

    next();
  };
}

export function methodNotAllowed(allow: readonly string[]): express.RequestHandler {
  return (_request, _response, next) => {
    next(new MethodNotAllowedError(allow));
  };
}

export function parseJsonBody(maxBodyBytes: number): express.RequestHandler {
  const parse = express.json({
    limit: maxBodyBytes,
    strict: false,
    type: () => true,
  });

  return (request, response, next) => {
    if (!acceptsJson(headerValue(request, "content-type"))) {
      next(clientError("UNSUPPORTED_MEDIA_TYPE"));
      return;
    }

    if (contentLength(request) === 0) {
      next(clientError("INVALID_JSON"));
      return;
    }

    parse(request, response, next);
  };
}

export function parseOptionalJson(maxBodyBytes: number): express.RequestHandler {
  const parse = express.json({
    limit: maxBodyBytes,
    strict: false,
    type: () => true,
  });

  return (request, response, next) => {
    const length = contentLength(request);

    if (
      length === 0 ||
      (length === undefined &&
        headerValue(request, "content-type") === undefined &&
        headerValue(request, "transfer-encoding") === undefined)
    ) {
      next();
      return;
    }

    if (!acceptsJson(headerValue(request, "content-type"))) {
      next(clientError("UNSUPPORTED_MEDIA_TYPE"));
      return;
    }

    parse(request, response, (error) => {
      if (error) {
        next(error);
        return;
      }

      try {
        parseCancelBody(request.body);
        next();
      } catch (caught) {
        next(caught);
      }
    });
  };
}

function headerValue(
  request: express.Request,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function contentLength(request: express.Request): number | undefined {
  const header = headerValue(request, "content-length");

  if (header === undefined || !/^[0-9]+$/.test(header)) {
    return undefined;
  }

  const length = Number(header);

  return Number.isSafeInteger(length) ? length : undefined;
}
