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
      let response: Response;

      try {
        response = await fetch(endpoint, {
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
      } catch {
        if (timeoutSignal.aborted) {
          throw new NovaTimeoutError();
        }

        throw new NovaUnavailableError();
      }

      if (!response.ok) {
        await response.text().catch(() => undefined);
        throw new NovaUnavailableError();
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new NovaUnavailableError();
      }

      return readGeminiText(payload);
    },
  };
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
