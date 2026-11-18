import type { ChainContext, Reason } from "./types.ts";

const strip = (a: string) => a.toLowerCase().replace(/^0x/, "");

/* ---------- address poisoning ---------- */
export function checkPoisoning(to: string, history: string[]): Reason[] {
  const t = strip(to);
  const known = history.map(strip);
  if (known.includes(t)) return [];
  for (const h of known) {
    if (t.slice(0, 4) === h.slice(0, 4) && t.slice(-4) === h.slice(-4)) {
      return [{
        code: "ADDRESS_POISONING", severity: "block",
        message: `Recipient looks like 0x${h} from your history (same first and last 4 characters) but is a different address. Classic address poisoning.`,
      }];
    }
  }
  return known.length > 0 ? [{ code: "NEW_RECIPIENT", severity: "warn", message: "You have not paid this address before." }] : [];
}

/* ---------- approvals ---------- */
const UNLIMITED = 1n << 255n;
const SEL = { approve: "095ea7b3", increaseAllowance: "39509351", setApprovalForAll: "a22cb465" };

export interface DecodedApproval { fn: string; spender: string; amount?: bigint; approved?: boolean }

export function decodeApproval(calldata: string): DecodedApproval | null {
  const d = calldata.toLowerCase().replace(/^0x/, "");
  if (d.length < 8 + 128) return null;
  const sel = d.slice(0, 8), spender = "0x" + d.slice(8 + 24, 72), w2 = BigInt("0x" + d.slice(72, 136));
  if (sel === SEL.approve) return { fn: "approve", spender, amount: w2 };
  if (sel === SEL.increaseAllowance) return { fn: "increaseAllowance", spender, amount: w2 };
  if (sel === SEL.setApprovalForAll) return { fn: "setApprovalForAll", spender, approved: w2 === 1n };
  return null;
}

export function checkApproval(calldata: string, knownSpenders: string[]): Reason[] {
  const d = decodeApproval(calldata);
  if (!d) return [];
  const out: Reason[] = [];
  const unlimited = d.amount !== undefined && d.amount >= UNLIMITED;
  if (d.fn === "setApprovalForAll" && d.approved) {
    out.push({ code: "NFT_BLANKET_APPROVAL", severity: "block", message: `This gives ${d.spender} control over EVERY token in the collection, now and in the future.` });
  }
  if (unlimited) {
    out.push({ code: "UNLIMITED_ALLOWANCE", severity: "warn", message: `This lets ${d.spender} spend an unlimited amount of your token at any time. Approve only what is needed.` });
  }
  if (!knownSpenders.map((s) => s.toLowerCase()).includes(d.spender.toLowerCase())) {
    out.push({ code: "NEW_SPENDER", severity: unlimited ? "block" : "warn", message: `${d.spender} is an address you have never approved before.` });
  }
  return out;
}

/* ---------- lookalike .ai names ---------- */
const NAME_RE = /^[a-z0-9]{3,15}$/;
export function skeleton(name: string): string {
  const map: Record<string, string> = { "1": "l", "0": "o", i: "l", "5": "s", "8": "b" };
  return name.toLowerCase().replace(/rn/g, "m").split("").map((c) => map[c] ?? c).join("");
}
function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
export function checkLookalikeName(name: string, registered: string[]): Reason[] {
  const n = name.toLowerCase().replace(/\.ai$/, "");
  if (!NAME_RE.test(n)) return [{ code: "INVALID_NAME", severity: "block", message: "Agent ID names are 3 to 15 lowercase letters or numbers." }];
  const sk = skeleton(n), out: Reason[] = [];
  for (const o of registered.map((r) => r.toLowerCase())) {
    if (o === n) continue;
    if (skeleton(o) === sk) out.push({ code: "LOOKALIKE_NAME", severity: "block", message: `"${n}.ai" is a visual lookalike of the registered name "${o}.ai" (characters like 1/l or 0/o swapped).` });
    else if (n.length >= 5 && lev(sk, skeleton(o)) === 1) out.push({ code: "NEAR_NAME", severity: "warn", message: `"${n}.ai" is one character away from "${o}.ai". Check the spelling.` });
  }
  return out;
}

/* ---------- two-way agent link + liveness ---------- */
export async function checkAgentLink(name: string, to: string, ctx: ChainContext): Promise<Reason[]> {
  const n = name.toLowerCase().replace(/\.ai$/, "");
  const rec = await ctx.resolveName(n);
  if (!rec) return [{ code: "NAME_UNRESOLVED", severity: "warn", message: `"${n}.ai" does not resolve to a known agent.` }];
  const out: Reason[] = [];
  if (rec.owner.toLowerCase() !== to.toLowerCase()) out.push({ code: "NAME_ADDRESS_MISMATCH", severity: "block", message: `"${n}.ai" belongs to ${rec.owner}, not the address you are paying.` });
  if (!rec.erc8004AgentId) out.push({ code: "NO_ERC8004", severity: "warn", message: "This name is not linked to an ERC-8004 agent identity." });
  else if (rec.backLinkedName?.toLowerCase() !== n) out.push({ code: "ONE_WAY_LINK", severity: "warn", message: "The agent's registration file does not point back to this name. The link is one-way." });
  if (rec.endpoint) {
    try {
      const r = await fetch(rec.endpoint, { signal: AbortSignal.timeout(4000) });
      if (r.status >= 500) out.push({ code: "ENDPOINT_DOWN", severity: "warn", message: `Agent endpoint answered ${r.status}.` });
    } catch {
      out.push({ code: "ENDPOINT_DOWN", severity: "warn", message: "Agent endpoint is not reachable." });
    }
  }
  return out;
}
