import { DomainInvariantError } from "../../../../domain/shared/domain-error.js";
import { requireMoney, type Money } from "../../../../domain/shared/money.js";

const maxSafeMinorUnits = BigInt(Number.MAX_SAFE_INTEGER);

export function moneyToDomain(amountMinor: bigint, currency: string): Money {
  if (amountMinor > maxSafeMinorUnits) {
    throw new DomainInvariantError(
      "Stored money exceeds the largest safe integer minor-unit amount.",
    );
  }

  return requireMoney({
    amountMinor: Number(amountMinor),
    currency: currency as Money["currency"],
  });
}

export function moneyToPersistence(money: Money): {
  amountMinor: bigint;
  currency: string;
} {
  return {
    amountMinor: BigInt(money.amountMinor),
    currency: money.currency,
  };
}
