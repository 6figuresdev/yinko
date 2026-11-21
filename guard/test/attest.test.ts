import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKey } from "../src/attest.ts";

const HEX = "ab".repeat(32);

test("normalizeKey accepts clean, unprefixed, quoted and labelled keys", () => {
  assert.equal(normalizeKey("0x" + HEX), "0x" + HEX);
  assert.equal(normalizeKey(HEX), "0x" + HEX);
  assert.equal(normalizeKey(`"0x${HEX}"`), "0x" + HEX);
  assert.equal(normalizeKey(`Private key: 0x${HEX}\n`), "0x" + HEX);
  assert.equal(normalizeKey(""), null);
  assert.equal(normalizeKey(undefined), null);
});
test("normalizeKey rejects an address or garbage without echoing it", () => {
  const address = "0x2E6b692c81A924F23BC3f3090973d24A422c0e7C";
  assert.throws(() => normalizeKey(address), (e: Error) => !e.message.includes("2E6b692c"));
  assert.throws(() => normalizeKey("not a key"), /32-byte hex key/);
});
