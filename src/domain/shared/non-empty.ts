import { DomainInvariantError } from "./domain-error.js";

export function requireNonEmpty(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainInvariantError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}
