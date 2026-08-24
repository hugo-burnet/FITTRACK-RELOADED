import assert from "node:assert/strict";
import { test } from "node:test";
import { validateE5Gold } from "../../tools/validate-e5-gold.mjs";

test("E5-GOLD is complete, traceable and contract-compatible", () => {
  const result = validateE5Gold();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.counts.primaryFragments, 100);
  assert.equal(result.counts.secondaryFragments, 30);
  assert.equal(result.counts.adjudicatedFragments, 100);
});
