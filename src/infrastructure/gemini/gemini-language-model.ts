import {
  NovaTimeoutError,
  NovaUnavailableError,
} from "../../application/errors.js";
import type { LanguageModel } from "../../application/ports/language-model.js";
import type { NovaConfig } from "./nova-config.js";

export function createGeminiLanguageModel(config: NovaConfig): LanguageModel {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  return {
    async generate(input) {
      const timeoutSignal = AbortSignal.timeout(config.timeoutMs);
      const signal = AbortSignal.any([input.signal, timeoutSignal]);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          redirect: "error",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": config.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: input.systemInstruction }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: input.userMessage }],
              },
            ],
            generationConfig: {
              maxOutputTokens: input.maxOutputTokens,
            },
          }),
          signal,
        });

        if (!response.ok) {
          await response.text();
          throw new NovaUnavailableError();
        }

        return readGeminiText(await response.json());
      } catch (error) {
        if (
          error instanceof NovaTimeoutError ||
          error instanceof NovaUnavailableError
        ) {
          throw error;
        }

        if (timedOut(timeoutSignal, error)) {
          throw new NovaTimeoutError();
        }

        throw new NovaUnavailableError();
      }
    },
  };
}

function timedOut(timeoutSignal: AbortSignal, error: unknown): boolean {
  return (
    timeoutSignal.aborted ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

function readGeminiText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw new NovaUnavailableError();
  }

  const candidates = Reflect.get(payload, "candidates");

  if (!Array.isArray(candidates)) {
    throw new NovaUnavailableError();
  }

  const content = candidates[0]?.content;
  const parts = content?.parts;

  if (!Array.isArray(parts)) {
    throw new NovaUnavailableError();
  }

  const text = parts
    .map((part: { text?: unknown }) =>
      typeof part?.text === "string" ? part.text : "",
    )
    .join("");

  if (text.trim().length === 0) {
    throw new NovaUnavailableError();
  }

  return text;
}
