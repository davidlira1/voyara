import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainInvariantError } from "./domain-error.js";
import { createVoyageId } from "./entity-id.js";

describe("createVoyageId", () => {
  it("brands the supplied id without changing it", () => {
    assert.equal(createVoyageId("voyage-1"), "voyage-1");
  });

  it("rejects an empty id", () => {
    assert.throws(() => createVoyageId(""), DomainInvariantError);
  });

  it("rejects a blank id", () => {
    assert.throws(() => createVoyageId("   "), DomainInvariantError);
  });
});
