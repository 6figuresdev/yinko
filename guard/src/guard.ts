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
  let matchesSavedAgent = false;
  if (req.agentName) {
    const typed = req.agentName.toLowerCase().replace(/\.ai$/, "");
    const saved = (Array.isArray(req.knownAgents) ? req.knownAgents : []).slice(0, 50)
      .filter((a) => a && typeof a.name === "string" && typeof a.address === "string")
      .map((a) => ({ name: a.name.toLowerCase().replace(/\.ai$/, ""), address: a.address.toLowerCase() }));
    // Names the caller trusts are compared too, so a lookalike of ANY saved agent is caught, not only the few the guard knows.
    reasons.push(...checkLookalikeName(req.agentName, [...(await ctx.registeredNames()), ...saved.map((a) => a.name)]));
    const link = await checkAgentLink(req.agentName, req.to, ctx);
    const mine = saved.find((a) => a.name === typed);
    if (mine && mine.address !== req.to.toLowerCase()) {
      reasons.push({ code: "NAME_DIFFERS_FROM_YOUR_CONTACT", severity: "block", message: `You saved "${typed}.ai" with a different address than the one you are paying.` });
    } else if (mine) {
      matchesSavedAgent = true;
    }
    // A name and address the caller saved themselves is not "unknown", but every other check still applies.
    reasons.push(...(matchesSavedAgent ? link.filter((r) => r.code !== "NAME_UNRESOLVED") : link));
  }
  let recipientHasAgentId: boolean | null = null;
  if (ctx.holdsAgentId && req.kind === "transfer") {
    recipientHasAgentId = await ctx.holdsAgentId(req.to).catch(() => null);
    if (req.agentName && recipientHasAgentId === false) {
      reasons.push({
        code: "NOT_AN_AGENT_ID_HOLDER", severity: "warn",
        message: `The address you are paying does not hold an Agent ID, but you are paying it as "${req.agentName.replace(/\.ai$/i, "")}.ai". Agent IDs are non-transferable, so a real agent's wallet should hold one.`,
      });
    }
  }
  let communitySignals: { reports: number; vouches: number } | null = null;
  if (ctx.watchSignals) {
    communitySignals = await ctx.watchSignals(req.to).catch(() => null);
    if (communitySignals && communitySignals.reports > 0) {
      const n = communitySignals.reports;
      reasons.push({
        code: "REPORTED_BY_AGENT_ID_HOLDERS",
        severity: n >= 2 ? "block" : "warn",
        message: `${n} Agent ID holder${n === 1 ? " has" : "s have"} reported this address as unsafe.`,
      });
    }
  }
  const verdict = reasons.reduce<Verdict>((v, r) => (rank[r.severity] > rank[v] ? r.severity : v), "allow");
  return { verdict, reasons, suggestedCap: cap(verdict, req.amount), recipientHasAgentId, communitySignals, matchesSavedAgent };
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
