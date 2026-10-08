import { createRandomId } from "./random-id.js";
import type { IdGenerator } from "../../application/ports/id-generator.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createConfirmationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "VY";

  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }

  return code;
}

export function createBookingIdGenerator(): IdGenerator {
  return {
    newId: createRandomId,
    newConfirmationCode: createConfirmationCode,
  };
}
