import { createWalletClient, http, parseAbi, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet } from "viem/chains";
import type { CheckResponse } from "./types.ts";
import { topReason } from "./guard.ts";

const ABI = parseAbi(["function attest(address target, uint8 verdict, bytes32 reason)"]);
const code = { allow: 0, warn: 1, block: 2 } as const;

/** Writes the verdict to YinkoRegistry. Returns the tx hash, or null when attestation is not configured. */
export async function attest(target: string, res: CheckResponse, env = process.env): Promise<string | null> {
  const key = env.GUARD_PRIVATE_KEY, registry = env.YINKO_REGISTRY as Address | undefined;
  if (!key || !registry) return null;
  const account = privateKeyToAccount((key.startsWith("0x") ? key : "0x" + key) as Hex);
  const wallet = createWalletClient({ account, chain: Number(env.CHAIN_ID ?? 97) === 56 ? bsc : bscTestnet, transport: http(env.BSC_RPC) });
  return wallet.writeContract({
    address: registry, abi: ABI, functionName: "attest",
    args: [target as Address, code[res.verdict], stringToHex(topReason(res).slice(0, 31), { size: 32 })],
  });
}
