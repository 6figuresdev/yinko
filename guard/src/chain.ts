import { createPublicClient, http, parseAbi, parseAbiItem, isAddress, type Address } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { existsSync, readFileSync } from "node:fs";
import type { AgentRecord, ChainContext } from "./types.ts";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const APPROVAL = parseAbiItem("event Approval(address indexed owner, address indexed spender, uint256 value)");
const AGENT_ID_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
// SPACE ID Agent ID registry (ERC-721, non-transferable) on BNB Smart Chain mainnet.
const AGENT_ID_MAINNET = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const ID_ABI = parseAbi(["function ownerOf(uint256) view returns (address)", "function tokenURI(uint256) view returns (string)"]);

interface NameEntry { owner: string; agentId?: string }

export function bscContext(env = process.env): ChainContext {
  const chain = Number(env.CHAIN_ID ?? 97) === 56 ? bsc : bscTestnet;
  const client = createPublicClient({ chain, transport: http(env.BSC_RPC) });
  const identity = env.IDENTITY_REGISTRY as Address | undefined;
  const agentIdRegistry = (env.AGENT_ID_REGISTRY ?? (Number(env.CHAIN_ID ?? 97) === 56 ? AGENT_ID_MAINNET : undefined)) as Address | undefined;
  const blocks = BigInt(env.HISTORY_BLOCKS ?? 50000);
  const chunk = BigInt(env.CHUNK_BLOCKS ?? 5000);
  const namesPath = new URL("../data/names.json", import.meta.url);
  const names = (): Record<string, NameEntry> => (existsSync(namesPath) ? JSON.parse(readFileSync(namesPath, "utf8")) : {});

  // Public RPCs cap getLogs ranges, so scan recent history in chunks. Failed chunks are skipped (partial history).
  async function scan<T>(fetchChunk: (from: bigint, to: bigint) => Promise<T[]>): Promise<T[]> {
    const latest = await client.getBlockNumber();
    const start = latest > blocks ? latest - blocks : 0n;
    const ranges: [bigint, bigint][] = [];
    for (let s = start; s <= latest; s += chunk) ranges.push([s, s + chunk - 1n > latest ? latest : s + chunk - 1n]);
    const out: T[] = [];
    for (let i = 0; i < ranges.length; i += 4) {
      const settled = await Promise.allSettled(ranges.slice(i, i + 4).map(([a, b]) => fetchChunk(a, b)));
      for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
    }
    return out;
  }

  const cache = new Map<string, { at: number; v: string[] }>();
  async function cached(key: string, load: () => Promise<string[]>) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.v;
    const v = [...new Set(await load())];
    cache.set(key, { at: Date.now(), v });
    return v;
  }

  async function fetchRegistrationFile(uri: string): Promise<any | null> {
    try {
      if (uri.startsWith("data:")) {
        const body = uri.slice(uri.indexOf(",") + 1);
        return JSON.parse(uri.includes(";base64") ? Buffer.from(body, "base64").toString() : decodeURIComponent(body));
      }
      const url = uri.startsWith("ipfs://") ? "https://ipfs.io/ipfs/" + uri.slice(7) : uri;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  return {
    // ERC-20 transfers only. Native BNB sends are not logs, so pass knownAddresses from the wallet's address book too.
    history: (from) => cached("h:" + from.toLowerCase(), async () => {
      if (!isAddress(from)) return [];
      const logs = await scan((fromBlock, toBlock) => client.getLogs({ event: TRANSFER, args: { from }, fromBlock, toBlock }));
      return logs.map((l) => l.args.to as string);
    }),
    knownSpenders: (from) => cached("s:" + from.toLowerCase(), async () => {
      if (!isAddress(from)) return [];
      const logs = await scan((fromBlock, toBlock) => client.getLogs({ event: APPROVAL, args: { owner: from }, fromBlock, toBlock }));
      return logs.map((l) => l.args.spender as string);
    }),
    // Agent IDs are non-transferable, so holding one means the address is a real Agentic Wallet identity.
    holdsAgentId: async (address) => {
      if (!agentIdRegistry || !isAddress(address)) return null;
      try {
        return (await client.readContract({ address: agentIdRegistry, abi: AGENT_ID_ABI, functionName: "balanceOf", args: [address] })) > 0n;
      } catch { return null; }
    },
    registeredNames: async () => Object.keys(names()),
    // Local names.json stands in for the Agent ID name registry until its interface is confirmed.
    // ERC-8004 half is read on-chain: ownerOf + tokenURI, then the registration file's "agentName" must point back.
    resolveName: async (name): Promise<AgentRecord | null> => {
      const entry = names()[name];
      if (!entry) return null;
      const rec: AgentRecord = { name, owner: entry.owner };
      if (entry.agentId && !identity) rec.readError = "IDENTITY_REGISTRY is not configured";
      if (entry.agentId && identity) {
        try {
          const id = BigInt(entry.agentId);
          rec.erc8004AgentId = entry.agentId;
          rec.owner = await client.readContract({ address: identity, abi: ID_ABI, functionName: "ownerOf", args: [id] });
          const file = await fetchRegistrationFile(await client.readContract({ address: identity, abi: ID_ABI, functionName: "tokenURI", args: [id] }));
          if (!file) rec.readError = "registration file could not be fetched or parsed";
          rec.backLinkedName = file?.agentName;
          rec.endpoint = file?.services?.find((s: any) => s?.endpoint)?.endpoint;
        } catch (e) {
          rec.readError = (e as any)?.shortMessage ?? (e as Error)?.message ?? "read failed";
        }
      }
      return rec;
    },
  };
}
