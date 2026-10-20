import type { Server } from "node:http";
import { createGeminiLanguageModel } from "../infrastructure/gemini/gemini-language-model.js";
import { loadNovaConfig } from "../infrastructure/gemini/nova-config.js";
import { createPrismaClient } from "../infrastructure/persistence/prisma/client.js";
import type { PrismaClient } from "../infrastructure/persistence/prisma/client.js";
import { loadHttpConfig } from "./config.js";
import { composeHttpServer } from "./compose.js";
import { closeServer } from "./server.js";

start().catch((error: unknown) => {
  if (error instanceof Error && error.name === "Error") {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.name : "Error");
  }

  process.exit(1);
});

async function start(): Promise<void> {
  const config = loadHttpConfig();
  const novaConfig = loadNovaConfig();
  const prisma = createPrismaClient();
  const server = composeHttpServer({
    prisma,
    devAccessToken: config.devAccessToken,
    languageModel: createGeminiLanguageModel(novaConfig),
  });
  let shuttingDown = false;

  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(error.name);
    void shutdown(1);
  });

  server.listen(config.port, config.host, () => {
    console.info(`Listening on http://${config.host}:${config.port}`);
  });

  process.on("SIGINT", () => {
    void shutdown(0);
  });

  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  async function shutdown(exitCode: number): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await stop(server, prisma);
    process.exit(exitCode);
  }
}

async function stop(httpServer: Server, database: PrismaClient): Promise<void> {
  if (httpServer.listening) {
    await closeServer(httpServer);
  }

  await database.$disconnect();
}
