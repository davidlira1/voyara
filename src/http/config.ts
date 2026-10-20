const minimumTokenLength = 16;

export type HttpConfig = {
  readonly host: string;
  readonly port: number;
  readonly devAccessToken: string;
};

export function loadHttpConfig(
  env: NodeJS.ProcessEnv = process.env,
): HttpConfig {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "The HTTP server refuses to start when NODE_ENV is production. The development access token is not production authentication.",
    );
  }

  return {
    host: readHost(env.HOST),
    port: readPort(env.PORT),
    devAccessToken: readDevAccessToken(env.VOYARA_DEV_ACCESS_TOKEN),
  };
}

function readHost(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return "127.0.0.1";
  }

  return value.trim();
}

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  if (!/^[1-9][0-9]*$/.test(value.trim())) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  const port = Number(value.trim());

  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  return port;
}

function readDevAccessToken(value: string | undefined): string {
  const token = value?.trim() ?? "";

  if (token.length < minimumTokenLength) {
    throw new Error(
      "VOYARA_DEV_ACCESS_TOKEN is required and must be at least 16 characters. Generate one locally and do not commit it.",
    );
  }

  return token;
}
