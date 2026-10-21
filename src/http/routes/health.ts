import { Router } from "express";
import { methodNotAllowed, routeContext } from "../route-middleware.js";

const template = "/health";

export function healthRouter(): Router {
  const router = Router({ caseSensitive: true });
  const context = routeContext(template, false);

  router
    .route("/")
    .head(context, methodNotAllowed(["GET"]))
    .get(context, (_request, response) => {
      response.json({ status: "ok" });
    })
    .all(context, methodNotAllowed(["GET"]));

  return router;
}
