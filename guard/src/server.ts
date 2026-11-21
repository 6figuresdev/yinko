import "./env.ts";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { isAddress } from "viem";
import { check } from "./guard.ts";
import { bscContext } from "./chain.ts";
import { attest } from "./attest.ts";
import type { CheckRequest } from "./types.ts";

const ctx = bscContext();

// Anyone can reach this API, so on-chain recording (which spends the guard wallet's gas) needs the operator token.
function tokenOk(header: string | string[] | undefined): boolean {
  const want = process.env.ATTEST_TOKEN;
  if (!want || typeof header !== "string") return false;
  const a = Buffer.from(header), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Best-effort per-instance rate limit: 30 checks a minute per caller.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}
const MAX_BODY = 20_000;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-yinko-token", "content-type": "application/json" };

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
  if (req.method === "GET" && req.url === "/health") return void res.writeHead(200, cors).end(JSON.stringify({ ok: true }));
  // Temporary diagnostics: shows which settings this deployment sees. Public addresses and an RPC hostname only, never secrets. Remove once mainnet is confirmed.
  if (req.method === "GET" && req.url?.startsWith("/diag")) {
    const host = (u?: string) => { try { return new URL(u!).host; } catch { return u ? "(invalid url)" : "(unset)"; } };
    const clean = (m: unknown) => String(m).replace(/https?:\/\/\S+/g, "[url]").slice(0, 300);
    const info: Record<string, unknown> = {
      chainId: process.env.CHAIN_ID ?? "(unset)",
      rpcHost: host(process.env.BSC_RPC),
      identityRegistry: process.env.IDENTITY_REGISTRY ?? "(unset)",
      yinkoRegistry: process.env.YINKO_REGISTRY ?? "(unset)",
      debugErrors: process.env.DEBUG_ERRORS ?? "(unset)",
      attestTokenSet: Boolean(process.env.ATTEST_TOKEN),
      guardKeySet: Boolean(process.env.GUARD_PRIVATE_KEY),
    };
    try {
      const rec = await ctx.resolveName("yinko");
      info.resolveYinko = rec
        ? { owner: rec.owner, agentId: rec.erc8004AgentId, backLinkedName: rec.backLinkedName, endpoint: rec.endpoint, readError: rec.readError ? clean(rec.readError) : null }
        : "not in names.json";
    } catch (e) { info.resolveYinko = { threw: clean(e) }; }
    return void res.writeHead(200, cors).end(JSON.stringify(info, null, 2));
  }
  if (req.method === "POST" && req.url === "/check") {
    const fwd = req.headers["x-forwarded-for"];
    const ip = (typeof fwd === "string" ? fwd.split(",")[0].trim() : req.socket.remoteAddress) ?? "unknown";
    if (limited(ip)) return void res.writeHead(429, cors).end(JSON.stringify({ error: "Too many checks. Try again in a minute." }));
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) return void res.writeHead(413, cors).end(JSON.stringify({ error: "Request too large." }));
    }
    try {
      const r = JSON.parse(body) as CheckRequest;
      if (!isAddress(r.from) || !isAddress(r.to)) throw new Error("from and to must be valid addresses");
      const out = await check(r, ctx);
      let attestationTx: string | null | undefined;
      if (r.attest) {
        attestationTx = tokenOk(req.headers["x-yinko-token"])
          ? await attest(r.to, out).catch((e) => `error: ${e.shortMessage ?? e.message}`)
          : "error: recording on-chain needs the operator token";
      }
      return void res.writeHead(200, cors).end(JSON.stringify({ ...out, attestationTx }));
    } catch (e) {
      return void res.writeHead(400, cors).end(JSON.stringify({ error: String((e as Error).message ?? e) }));
    }
  }
  res.writeHead(404, cors).end("{}");
}).listen(8787, () => console.log("Yinko guard listening on http://localhost:8787"));
