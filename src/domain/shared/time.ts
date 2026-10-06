import { DomainInvariantError } from "./domain-error.js";

/** Copies a UTC instant so callers cannot mutate a stored timestamp. */
export function requireInstant(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainInvariantError(`${label} must be a valid instant.`);
  }

  return new Date(value.getTime());
}
