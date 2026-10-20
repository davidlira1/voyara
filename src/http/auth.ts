import { timingSafeEqual } from "node:crypto";

export function authorizeDevAccess(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (authorizationHeader === undefined) {
    return false;
  }

  const match = /^Bearer ([!-~]+)$/.exec(authorizationHeader);

  if (match === null) {
    return false;
  }

  const supplied = match[1];

  if (supplied === undefined) {
    return false;
  }

  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expectedToken);

  if (suppliedBytes.length !== expectedBytes.length) {
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }

  return timingSafeEqual(suppliedBytes, expectedBytes);
}
