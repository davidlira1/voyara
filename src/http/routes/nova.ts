import { Router } from "express";
import { chatWithNova } from "../../application/nova/chat-with-nova.js";
import type { HttpDependencies } from "../dependencies.js";
import { parseNovaMessage } from "../json.js";
import {
  methodNotAllowed,
  parseJsonBody,
  requireDevAccess,
  routeContext,
} from "../route-middleware.js";

export function novaRouter(
  dependencies: HttpDependencies,
  maxBodyBytes: number,
): Router {
  const router = Router({ caseSensitive: true });
  const context = routeContext("/api/nova/chat", true);

  router
    .route("/chat")
    .post(
      context,
      requireDevAccess(dependencies.devAccessToken),
      parseJsonBody(maxBodyBytes),
      async (request, response) => {
        response.json(
          await chatWithNova(parseNovaMessage(request.body), {
            model: dependencies.languageModel,
          }),
        );
      },
    )
    .all(context, methodNotAllowed(["POST"]));

  return router;
}
