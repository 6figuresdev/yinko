import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isAddress } from "viem";
import { check } from "./guard.ts";
import { attest } from "./attest.ts";
import type { ChainContext } from "./types.ts";

const addr = z.string().refine(isAddress, "must be a valid 0x address");

export function createMcpServer(ctx: ChainContext): McpServer {
  const server = new McpServer({ name: "yinko", version: "0.3.0" });

  server.registerTool(
    "yinko_check",
    {
      title: "Yinko pre-signature check",
      description:
        "Call BEFORE signing or sending a payment or token approval on BNB Chain. Returns verdict allow|warn|block, plain-language reasons " +
        "(address poisoning, unlimited or new-spender approvals, lookalike .ai Agent ID names, one-way ERC-8004 agent links) and a suggested spend cap. " +
        "Never proceed on a 'block' verdict. For a 'warn', stay at or under suggestedCap or ask the human.",
      inputSchema: {
        from: addr.describe("The wallet that will sign"),
        to: addr.describe("Recipient address, or the spender/contract for an approval"),
        kind: z.enum(["transfer", "approval"]),
        amount: z.string().optional().describe("Amount in human units, e.g. '25.5'"),
        calldata: z.string().optional().describe("For approvals: the 0x transaction data about to be signed"),
        agentName: z.string().optional().describe("A .ai Agent ID name the recipient claims, e.g. 'payagent'"),
        knownAddresses: z.array(z.string()).optional().describe("Addresses this wallet has paid before (address book)"),
        attest: z.boolean().optional().describe("Also record the verdict on-chain in YinkoRegistry"),
      },
    },
    async (args) => {
      const result = await check(args, ctx);
      const attestationTx = args.attest ? await attest(args.to, result).catch((e) => `error: ${e.shortMessage ?? e.message}`) : undefined;
      return { content: [{ type: "text", text: JSON.stringify({ ...result, attestationTx }, null, 2) }] };
    },
  );

  return server;
}
