import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../src/guard.ts";
import type { ChainContext } from "../src/types.ts";

const GOOD = "0xA1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const POISON = "0xA1b2" + "0".repeat(32) + "5678";
const ME = "0x9444a989DB863d256de4F5395f9b10CBE425Ad1D";
const pad = (a: string) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const OWNER = "0x1111111111111111111111111111111111111111";

const ctx: ChainContext = {
  history: async () => [GOOD],
  knownSpenders: async () => ["0x10ED43C718714eb63d5aA57B78B54704E256024E"],
  registeredNames: async () => ["payagent", "yinko"],
  resolveName: async (n) =>
    n === "payagent" ? { name: n, owner: OWNER, erc8004AgentId: "1", backLinkedName: "payagent" }
    : n === "oneway" ? { name: n, owner: OWNER, erc8004AgentId: "2", backLinkedName: "other" }
    : null,
};

test("act 1: poisoned address is blocked", async () => {
  const r = await check({ from: ME, to: POISON, kind: "transfer", amount: "100" }, ctx);
  assert.equal(r.verdict, "block");
  assert.equal(r.reasons[0].code, "ADDRESS_POISONING");
  assert.equal(r.suggestedCap, "0");
});
test("address book entries count as history", async () => {
  const BOOK = "0xBEEF000000000000000000000000000000001234";
  const poisonedBook = "0xBEEF" + "0".repeat(32) + "1234";
  const r = await check({ from: ME, to: poisonedBook.replace("0000", "0001"), kind: "transfer", knownAddresses: [BOOK] }, ctx);
  assert.equal(r.verdict, "block");
});
test("known address passes", async () => {
  assert.equal((await check({ from: ME, to: GOOD, kind: "transfer" }, ctx)).verdict, "allow");
});
test("act 2a: lookalike name is blocked", async () => {
  const r = await check({ from: ME, to: OWNER, kind: "transfer", agentName: "y1nko" }, ctx);
  assert.ok(r.reasons.some((x) => x.code === "LOOKALIKE_NAME"));
  assert.equal(r.verdict, "block");
});
test("act 2b: unlimited approval to a new spender is blocked", async () => {
  const spender = "0x" + "ab".repeat(20);
  const r = await check({ from: ME, to: spender, kind: "approval", calldata: "0x095ea7b3" + pad(spender) + "f".repeat(64) }, ctx);
  assert.equal(r.verdict, "block");
  assert.deepEqual(r.reasons.map((x) => x.code).sort(), ["NEW_SPENDER", "UNLIMITED_ALLOWANCE"]);
});
test("known spender with bounded amount passes", async () => {
  const s = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const r = await check({ from: ME, to: s, kind: "approval", calldata: "0x095ea7b3" + pad(s) + (1000n).toString(16).padStart(64, "0") }, ctx);
  assert.equal(r.verdict, "allow");
});
test("act 3: verified two-way linked agent passes; one-way link warns; wrong owner blocks", async () => {
  assert.equal((await check({ from: ME, to: OWNER, kind: "transfer", knownAddresses: [OWNER], agentName: "payagent" }, ctx)).verdict, "allow");
  const ow = await check({ from: ME, to: OWNER, kind: "transfer", knownAddresses: [OWNER], agentName: "oneway" }, ctx);
  assert.ok(ow.reasons.some((x) => x.code === "ONE_WAY_LINK"));
  const bad = await check({ from: ME, to: GOOD, kind: "transfer", agentName: "payagent" }, ctx);
  assert.ok(bad.reasons.some((x) => x.code === "NAME_ADDRESS_MISMATCH"));
});
test("RPC failure degrades to a warning instead of crashing", async () => {
  const broken: ChainContext = { ...ctx, history: async () => { throw new Error("rpc down"); } };
  const r = await check({ from: ME, to: GOOD, kind: "transfer", knownAddresses: [GOOD] }, broken);
  assert.ok(r.reasons.some((x) => x.code === "HISTORY_UNAVAILABLE"));
  assert.equal(r.verdict, "warn");
});
