import {
  InvalidNovaMessageError,
  NovaUnavailableError,
} from "../errors.js";
import type { LanguageModel } from "../ports/language-model.js";
import { novaSystemInstruction } from "./nova-instructions.js";

export const MAX_NOVA_MESSAGE_LENGTH = 2_000;
export const MAX_NOVA_REPLY_LENGTH = 4_000;
export const NOVA_MAX_OUTPUT_TOKENS = 1_024;

export async function chatWithNova(
  message: string,
  dependencies: {
    model: LanguageModel;
    signal?: AbortSignal;
  },
): Promise<{ reply: string }> {
  if (typeof message !== "string") {
    throw new InvalidNovaMessageError();
  }

  const userMessage = message.trim();

  if (
    userMessage.length === 0 ||
    userMessage.length > MAX_NOVA_MESSAGE_LENGTH
  ) {
    throw new InvalidNovaMessageError();
  }

  const reply = (
    await dependencies.model.generate({
      systemInstruction: novaSystemInstruction,
      userMessage,
      maxOutputTokens: NOVA_MAX_OUTPUT_TOKENS,
      signal: dependencies.signal ?? new AbortController().signal,
    })
  ).trim();

  if (reply.length === 0) {
    throw new NovaUnavailableError();
  }

  return { reply: reply.slice(0, MAX_NOVA_REPLY_LENGTH) };
}
