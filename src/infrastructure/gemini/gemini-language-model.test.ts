import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  NovaTimeoutError,
  NovaUnavailableError,
} from "../../application/errors.js";
import type { LanguageModelRequest } from "../../application/ports/language-model.js";
import { createGeminiLanguageModel } from "./gemini-language-model.js";

const apiKey = "test-gemini-key";
const providerSecret = "provider-secret-payload";
const originalFetch = globalThis.fetch;

const request: LanguageModelRequest = {
  systemInstruction: "You are Nova, the flight concierge.",
  userMessage: "I want to see Mars.",
  maxOutputTokens: 1024,
  signal: new AbortController().signal,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Gemini language model", () => {
  it("parses a successful reply without putting the API key in the URL", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (url, init) => {
      requestedUrl = String(url);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-goog-api-key"), apiKey);
      const body = JSON.parse(String(init?.body)) as {
        systemInstruction: { parts: Array<{ text: string }> };
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      };
      assert.equal(body.systemInstruction.parts[0]?.text, request.systemInstruction);
      assert.equal(body.contents[0]?.role, "user");
      assert.equal(body.contents[0]?.parts[0]?.text, request.userMessage);
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: "Where would you like to go?" }],
            },
          },
        ],
      });
    }) as typeof fetch;

    const reply = await createGeminiLanguageModel(config(20_000)).generate(request);

    assert.equal(reply, "Where would you like to go?");
    assert.equal(requestedUrl.includes(apiKey), false);
    assert.match(requestedUrl, /models\/gemini-2\.5-flash:generateContent$/);
  });

  it("hides an upstream HTTP failure", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { message: `${apiKey} ${providerSecret}` },
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    await assertSafe(
      () => createGeminiLanguageModel(config(20_000)).generate(request),
      NovaUnavailableError,
    );
  });

  it("hides malformed and empty payloads", async () => {
    const payloads = [
      `not-json ${providerSecret}`,
      JSON.stringify({ debug: providerSecret }),
      JSON.stringify({ candidates: [], debug: providerSecret }),
      JSON.stringify({
        debug: providerSecret,
        candidates: [{ content: { parts: [{ text: "   " }] } }],
      }),
    ];

    for (const payload of payloads) {
      globalThis.fetch = (async () =>
        new Response(payload, {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;

      await assertSafe(
        () => createGeminiLanguageModel(config(20_000)).generate(request),
        NovaUnavailableError,
      );
    }
  });

  it("treats a timeout while reading the response body as NovaTimeoutError", async () => {
    globalThis.fetch = (async (_url, init) => {
      const signal = init?.signal;

      if (signal === undefined || signal === null) {
        throw new Error("Gemini request did not receive an abort signal.");
      }

      const body = new ReadableStream({
        start(controller) {
          signal.addEventListener(
            "abort",
            () => {
              controller.error(
                signal.reason instanceof Error
                  ? signal.reason
                  : new DOMException("The operation timed out.", "TimeoutError"),
              );
            },
            { once: true },
          );
        },
      });

      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await assertSafe(
      () => createGeminiLanguageModel(config(30)).generate(request),
      NovaTimeoutError,
    );
  });
});

function config(timeoutMs: number) {
  return {
    apiKey,
    model: "gemini-2.5-flash",
    timeoutMs,
  };
}

async function assertSafe(
  call: () => Promise<string>,
  errorType: typeof NovaUnavailableError | typeof NovaTimeoutError,
): Promise<void> {
  await assert.rejects(call, (error: unknown) => {
    assert.ok(error instanceof errorType);
    const rendered = `${error.name}\n${error.message}`;
    assert.equal(rendered.includes(apiKey), false);
    assert.equal(rendered.includes(providerSecret), false);
    return true;
  });
}
