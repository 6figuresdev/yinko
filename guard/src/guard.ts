import type { ChainContext, CheckRequest, CheckResponse, Reason, Verdict } from "./types.ts";
import { checkAgentLink, checkApproval, checkLookalikeName, checkPoisoning } from "./checks.ts";

const rank: Record<Verdict, number> = { allow: 0, warn: 1, block: 2 };

export async function check(req: CheckRequest, ctx: ChainContext): Promise<CheckResponse> {
  const reasons: Reason[] = [];
  if (req.kind === "transfer") {
    let onchain: string[] = [];
    try { onchain = await ctx.history(req.from); }
    catch { reasons.push({ code: "HISTORY_UNAVAILABLE", severity: "warn", message: "Could not read on-chain history (RPC problem). Checked against your address book only." }); }
    reasons.push(...checkPoisoning(req.to, [...onchain, ...(req.knownAddresses ?? [])]));
  }
  if (req.kind === "approval" && req.calldata) {
    let spenders: string[] = [];
    try { spenders = await ctx.knownSpenders(req.from); }
    catch { reasons.push({ code: "HISTORY_UNAVAILABLE", severity: "warn", message: "Could not read past approvals (RPC problem), so every spender looks new." }); }
    reasons.push(...checkApproval(req.calldata, spenders));
  }
  if (req.agentName) {
    reasons.push(...checkLookalikeName(req.agentName, await ctx.registeredNames()));
    reasons.push(...(await checkAgentLink(req.agentName, req.to, ctx)));
  }
  const verdict = reasons.reduce<Verdict>((v, r) => (rank[r.severity] > rank[v] ? r.severity : v), "allow");
  return { verdict, reasons, suggestedCap: cap(verdict, req.amount) };
}

function cap(v: Verdict, amount?: string): string | null {
  if (v === "block") return "0";
  if (v === "warn" && amount) return String(Number(amount) * 0.1);
  return amount ?? null;
}

export function topReason(res: CheckResponse): string {
  const worst = [...res.reasons].sort((a, b) => rank[b.severity] - rank[a.severity])[0];
  return worst?.code ?? "OK";
}
