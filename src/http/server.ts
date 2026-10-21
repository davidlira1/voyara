import { createServer, type Server } from "node:http";
import { createApp } from "./app.js";
import type { HttpDependencies } from "./dependencies.js";

export type { HttpDependencies, HttpLog } from "./dependencies.js";

export function createHttpServer(dependencies: HttpDependencies): Server {
  return createServer(createApp(dependencies));
}

export function listen(server: Server, host = "127.0.0.1"): Promise<URL> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.removeListener("error", reject);
      const address = server.address();

      if (address === null || typeof address === "string") {
        reject(new Error("HTTP server did not bind to a TCP port."));
        return;
      }

      resolve(new URL(`http://127.0.0.1:${address.port}`));
    });
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
