import type { RequestHandler } from "express";
import type { HttpLog } from "./dependencies.js";

export function requestLog(log: HttpLog): RequestHandler {
  return (request, response, next) => {
    response.on("finish", () => {
      const template = response.locals.routeTemplate;
      log.access({
        method: request.method,
        route: typeof template === "string" ? template : "unmatched",
        status: response.statusCode,
      });
    });
    next();
  };
}

export const defaultHttpLog: HttpLog = {
  access(entry) {
    console.info(JSON.stringify({ level: "info", ...entry }));
  },
  failure(entry) {
    console.error(JSON.stringify({ level: "error", ...entry }));
  },
};
