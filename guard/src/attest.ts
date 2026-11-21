import { createWalletClient, http, parseAbi, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet } from "viem/chains";
import type { CheckResponse } from "./types.ts";
import { topReason } from "./guard.ts";

/** Accepts a pasted key even with a label, quotes or stray whitespace; rejects anything that is not 32 bytes of hex. Never echoes the key. */
export function normalizeKey(raw: string | undefined): Hex | null {
  if (!raw) return null;
  const k = raw.trim().replace(/^private key:\s*/i, "").replace(/^["']|["']$/g, "").trim();
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(k)) throw new Error("GUARD_PRIVATE_KEY is not a 32-byte hex key (remove any label, quotes or spaces)");
  return (k.startsWith("0x") ? k : "0x" + k) as Hex;
}

const ABI = parseAbi(["function attest(address target, uint8 verdict, bytes32 reason)"]);
const code = { allow: 0, warn: 1, block: 2 } as const;

/** Writes the verdict to YinkoRegistry. Returns the tx hash, or null when attestation is not configured. */
export async function attest(target: string, res: CheckResponse, env = process.env): Promise<string | null> {
  const key = normalizeKey(env.GUARD_PRIVATE_KEY), registry = env.YINKO_REGISTRY as Address | undefined;
  if (!key || !registry) return null;
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: Number(env.CHAIN_ID ?? 97) === 56 ? bsc : bscTestnet, transport: http(env.BSC_RPC) });
  return wallet.writeContract({
    address: registry, abi: ABI, functionName: "attest",
    args: [target as Address, code[res.verdict], stringToHex(topReason(res).slice(0, 31), { size: 32 })],
  });
}
