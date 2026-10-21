export type NovaConfig = {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
};

const defaultModel = "gemini-2.5-flash";
const defaultTimeoutMs = 20_000;
const minimumTimeoutMs = 1_000;
const maximumTimeoutMs = 120_000;

export function loadNovaConfig(
  env: NodeJS.ProcessEnv = process.env,
): NovaConfig {
  return {
    apiKey: readApiKey(env.GEMINI_API_KEY),
    model: readModel(env.GEMINI_MODEL),
    timeoutMs: readTimeout(env.NOVA_TIMEOUT_MS),
  };
}

function readApiKey(value: string | undefined): string {
  const apiKey = value?.trim() ?? "";

  if (apiKey.length === 0 || /[\r\n]/.test(apiKey)) {
    throw new Error(
      "GEMINI_API_KEY is required. Set it in the environment and do not commit it.",
    );
  }

  return apiKey;
}

function readModel(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return defaultModel;
  }

  const model = value.trim();

  if (!/^[A-Za-z0-9._-]+$/.test(model)) {
    throw new Error(
      "GEMINI_MODEL must contain only letters, numbers, dots, underscores, and hyphens.",
    );
  }

  return model;
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return defaultTimeoutMs;
  }

  if (!/^[1-9][0-9]*$/.test(value.trim())) {
    throw new Error(
      `NOVA_TIMEOUT_MS must be an integer from ${minimumTimeoutMs} to ${maximumTimeoutMs}.`,
    );
  }

  const timeoutMs = Number(value.trim());

  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < minimumTimeoutMs ||
    timeoutMs > maximumTimeoutMs
  ) {
    throw new Error(
      `NOVA_TIMEOUT_MS must be an integer from ${minimumTimeoutMs} to ${maximumTimeoutMs}.`,
    );
  }

  return timeoutMs;
}
