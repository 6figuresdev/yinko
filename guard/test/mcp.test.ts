import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.ts";
import type { ChainContext } from "../src/types.ts";

const ME = "0x9444a989DB863d256de4F5395f9b10CBE425Ad1D";
const GOOD = "0xA1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const POISON = "0xA1b2" + "0".repeat(32) + "5678";
const ctx: ChainContext = { history: async () => [GOOD], knownSpenders: async () => [], registeredNames: async () => [], resolveName: async () => null };

test("MCP tool lists and blocks a poisoned address", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createMcpServer(ctx).connect(a);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(b);

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name), ["yinko_check"]);

  const res: any = await client.callTool({ name: "yinko_check", arguments: { from: ME, to: POISON, kind: "transfer", amount: "50" } });
  const out = JSON.parse(res.content[0].text);
  assert.equal(out.verdict, "block");
  assert.equal(out.reasons[0].code, "ADDRESS_POISONING");
});
