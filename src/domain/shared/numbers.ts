import { DomainInvariantError } from "./domain-error.js";

export function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainInvariantError(
      `${label} must be an integer greater than zero.`,
    );
  }

  return value;
}
