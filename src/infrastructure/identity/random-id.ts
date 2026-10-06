/** Supplies a new opaque id. The domain and the database do not generate ids. */
export function createRandomId(): string {
  return crypto.randomUUID();
}
