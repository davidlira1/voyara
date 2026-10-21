import { Router } from "express";
import { getVoyage, listVoyages } from "../../application/voyages/voyage-queries.js";
import type { HttpDependencies } from "../dependencies.js";
import { clientError } from "../errors.js";
import { serializeVoyage } from "../json.js";
import { methodNotAllowed, routeContext } from "../route-middleware.js";

export function voyagesRouter(dependencies: HttpDependencies): Router {
  const router = Router({ caseSensitive: true });
  const listContext = routeContext("/api/voyages", false);
  const detailContext = routeContext("/api/voyages/:code", false);

  router
    .route("/")
    .head(listContext, methodNotAllowed(["GET"]))
    .get(listContext, async (_request, response) => {
      const voyages = await listVoyages(dependencies.voyages);
      response.json({ voyages: voyages.map(serializeVoyage) });
    })
    .all(listContext, methodNotAllowed(["GET"]));

  router
    .route("/:code")
    .head(detailContext, methodNotAllowed(["GET"]))
    .get(detailContext, async (request, response) => {
      response.json(
        serializeVoyage(
          await getVoyage(dependencies.voyages, pathParam(request.params.code)),
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
