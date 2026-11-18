import "./env.ts";
import { createServer } from "node:http";
import { isAddress } from "viem";
import { check } from "./guard.ts";
import { bscContext } from "./chain.ts";
import { attest } from "./attest.ts";
import type { CheckRequest } from "./types.ts";

const ctx = bscContext();
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "content-type": "application/json" };

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
  if (req.method === "GET" && req.url === "/health") return void res.writeHead(200, cors).end(JSON.stringify({ ok: true }));
  if (req.method === "POST" && req.url === "/check") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const r = JSON.parse(body) as CheckRequest;
      if (!isAddress(r.from) || !isAddress(r.to)) throw new Error("from and to must be valid addresses");
      const out = await check(r, ctx);
      const attestationTx = r.attest ? await attest(r.to, out).catch((e) => `error: ${e.shortMessage ?? e.message}`) : undefined;
      return void res.writeHead(200, cors).end(JSON.stringify({ ...out, attestationTx }));
    } catch (e) {
      return void res.writeHead(400, cors).end(JSON.stringify({ error: String((e as Error).message ?? e) }));
    }
  }
  res.writeHead(404, cors).end("{}");
}).listen(8787, () => console.log("Yinko guard listening on http://localhost:8787"));
