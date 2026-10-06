import { DomainInvariantError } from "./domain-error.js";

export const USD = "USD" as const;

export type CurrencyCode = typeof USD;

/** Non-negative integer minor units. $12,500 is 1_250_000 cents. */
export type Money = {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
};

/**
 * Exact positive ratio. 1.0× is 1/1, 1.4× is 7/5, and 2.5× is 5/2.
 * Binary floating point is not used.
 */
export type FareMultiplier = {
  readonly numerator: number;
  readonly denominator: number;
};

export function createMoney(amountMinor: number): Money {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new DomainInvariantError(
      "Money amount must be a non-negative safe integer in minor units.",
    );
  }

  return Object.freeze({
    amountMinor,
    currency: USD,
  });
}

export function requireMoney(value: Money): Money {
  if (typeof value !== "object" || value === null) {
    throw new DomainInvariantError("Money is required.");
  }

  if (value.currency !== USD) {
    throw new DomainInvariantError("Money currency must be USD.");
  }

  return createMoney(value.amountMinor);
}

export function createFareMultiplier(
  numerator: number,
  denominator: number,
): FareMultiplier {
  return Object.freeze({
    numerator: requireMultiplierPart(numerator, "Fare multiplier numerator"),
    denominator: requireMultiplierPart(
      denominator,
      "Fare multiplier denominator",
    ),
  });
}

export function requireFareMultiplier(value: FareMultiplier): FareMultiplier {
  if (typeof value !== "object" || value === null) {
    throw new DomainInvariantError("Fare multiplier is required.");
  }

  return createFareMultiplier(value.numerator, value.denominator);
}

/**
 * Multiplies money by an exact ratio.
 * A remainder of half a minor unit rounds away from zero.
 */
export function multiplyMoney(
  amount: Money,
  multiplier: FareMultiplier,
): Money {
  const validatedAmount = requireMoney(amount);
  const validatedMultiplier = requireFareMultiplier(multiplier);
  const numerator =
    BigInt(validatedAmount.amountMinor) * BigInt(validatedMultiplier.numerator);
  const denominator = BigInt(validatedMultiplier.denominator);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded =
    remainder * 2n >= denominator ? quotient + 1n : quotient;

  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DomainInvariantError(
      "Multiplied money exceeds the largest safe integer minor-unit amount.",
    );
  }

  return createMoney(Number(rounded));
}

function requireMultiplierPart(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainInvariantError(`${label} must be a positive integer.`);
  }

  return value;
}
