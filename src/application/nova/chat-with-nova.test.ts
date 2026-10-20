import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InvalidNovaMessageError,
  NovaTimeoutError,
  NovaUnavailableError,
} from "../errors.js";
import type {
  LanguageModel,
  LanguageModelRequest,
} from "../ports/language-model.js";
import {
  MAX_NOVA_MESSAGE_LENGTH,
  MAX_NOVA_REPLY_LENGTH,
  chatWithNova,
} from "./chat-with-nova.js";
import { novaSystemInstruction } from "./nova-instructions.js";

describe("chatWithNova", () => {
  it("returns the model reply and keeps the instruction separate from the user message", async () => {
    let seen: LanguageModelRequest | undefined;
    const reply = await chatWithNova("  I want to see Mars.  ", {
      model: {
        async generate(input) {
          seen = input;
          return " Tell me what kind of journey you have in mind. ";
        },
      },
    });

    assert.equal(reply.reply, "Tell me what kind of journey you have in mind.");
    assert.ok(seen !== undefined);
    assert.equal(seen.userMessage, "I want to see Mars.");
    assert.equal(seen.systemInstruction, novaSystemInstruction);
    assert.equal(seen.systemInstruction.includes(seen.userMessage), false);
    assert.match(seen.systemInstruction, /flight concierge/i);
    assert.match(seen.systemInstruction, /cannot check live Voyara records yet/);
    assert.match(seen.systemInstruction, /must not invent flight numbers, fares, seat counts, or confirmation codes/);
    assert.equal(seen.maxOutputTokens, 1024);
  });

  it("rejects a blank or oversized message before calling the model", async () => {
    let calls = 0;
    const model: LanguageModel = {
      async generate() {
        calls += 1;
        return "unused";
      },
    };

    await assert.rejects(
      () => chatWithNova("   ", { model }),
      InvalidNovaMessageError,
    );
    await assert.rejects(
      () => chatWithNova("x".repeat(MAX_NOVA_MESSAGE_LENGTH + 1), { model }),
      InvalidNovaMessageError,
    );
    assert.equal(calls, 0);
  });

  it("caps a reply that is longer than the output limit", async () => {
    const reply = await chatWithNova("Hello", {
      model: {
        async generate() {
          return "n".repeat(MAX_NOVA_REPLY_LENGTH + 250);
        },
      },
    });

    assert.equal(reply.reply.length, MAX_NOVA_REPLY_LENGTH);
    assert.equal(reply.reply, "n".repeat(MAX_NOVA_REPLY_LENGTH));
  });

  it("propagates timeout and unavailable failures", async () => {
    await assert.rejects(
      () =>
        chatWithNova("Hello", {
          model: {
            async generate() {
              throw new NovaTimeoutError();
            },
          },
        }),
      NovaTimeoutError,
    );
    await assert.rejects(
      () =>
        chatWithNova("Hello", {
          model: {
            async generate() {
              return "   ";
            },
          },
        }),
      NovaUnavailableError,
    );
  });
});
