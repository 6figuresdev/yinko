import { ATTESTED, LINKED, REASON_TEXT, decodeLog, shortAddr, timeAgo } from "./decode.js";

const CONFIG = {
  rpcs: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com",
    "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
  ],
  registry: "0x760f6475de49bE4B1caac9849B9CE36421E1E7dA",
  identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  deployBlock: 143522632,
  explorer: "https://testnet.bscscan.com",
  defaultApi: "http://localhost:8787",
  repo: "https://github.com/6figuresdev/yinko",
  pollMs: 15000,
  chunk: 4000,
};

const $ = (id) => document.getElementById(id);
document.getElementById("repo").href = CONFIG.repo;

/* ---------------- live demo ---------------- */
const ME = "0x9444a989DB863d256de4F5395f9b10CBE425Ad1D";
const pad = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const SPENDER = "0x" + "ab".repeat(20);

const PRESETS = [
  { title: "A look-alike address", note: "Same first and last characters as one you paid before.",
    req: { from: ME, to: "0xA1b2" + "0".repeat(32) + "5678", kind: "transfer", amount: "100", knownAddresses: ["0xA1b2c3d4e5f60718293a4b5c6d7e8f9012345678"] } },
  { title: "An unlimited approval", note: "A new contract asks to spend all of your tokens.",
    req: { from: ME, to: SPENDER, kind: "approval", calldata: "0x095ea7b3" + pad(SPENDER) + "f".repeat(64) } },
  { title: "A fake agent name", note: "y1nko.ai instead of yinko.ai.",
    req: { from: ME, to: "0x5555555555555555555555555555555555555555", kind: "transfer", amount: "25", agentName: "y1nko" } },
  { title: "A verified agent", note: "yinko.ai, linked both ways to ERC-8004 agent 2880.",
    req: { from: "0x1111111111111111111111111111111111111111", to: ME, kind: "transfer", amount: "25", agentName: "yinko", knownAddresses: [ME] } },
];

const apiInput = $("api");
try { apiInput.value = localStorage.getItem("yinko.api") || CONFIG.defaultApi; } catch { apiInput.value = CONFIG.defaultApi; }
apiInput.addEventListener("change", () => { try { localStorage.setItem("yinko.api", apiInput.value.trim()); } catch {} });

const presetList = $("presets");
PRESETS.forEach((p, i) => {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `${esc(p.title)}<small>${esc(p.note)}</small>`;
  b.addEventListener("click", () => run(i, b));
  li.appendChild(b);
  presetList.appendChild(li);
});

async function run(i, btn) {
  presetList.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
  const req = { ...PRESETS[i].req };
  if ($("attest").checked) req.attest = true;
  $("request").textContent = JSON.stringify(req, null, 2);
  const out = $("result");
  out.dataset.verdict = "";
  out.innerHTML = `<p class="empty">Checking...</p>`;
  try {
    const res = await fetch(apiInput.value.trim().replace(/\/$/, "") + "/check", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "The guard returned an error.");
    showResult(data);
  } catch (e) {
    out.dataset.verdict = "";
    out.innerHTML = `<p class="empty">Could not reach the guard at ${esc(apiInput.value)}. Start it with <code>npm start</code> in the guard folder, or change the address on the left.</p>`;
  }
}

function showResult(d) {
  const out = $("result");
  out.dataset.verdict = d.verdict;
  const reasons = d.reasons.length
    ? `<ul>${d.reasons.map((r) => `<li>${esc(r.message)}</li>`).join("")}</ul>`
    : `<p class="empty">The recipient checked out. No warnings.</p>`;
  const cap = d.verdict === "block" ? "Do not sign. Suggested spend cap: 0."
    : d.suggestedCap ? `Suggested spend cap: ${esc(d.suggestedCap)}.` : "";
  let tx = "";
  if (d.attestationTx) {
    tx = String(d.attestationTx).startsWith("0x")
      ? `<p>Recorded on-chain: <a class="tx" href="${CONFIG.explorer}/tx/${esc(d.attestationTx)}" target="_blank" rel="noopener">${esc(shortAddr(d.attestationTx))}</a></p>`
      : `<p>On-chain record failed: ${esc(d.attestationTx)}</p>`;
  }
  out.innerHTML = `<p class="verdict">${esc(d.verdict[0].toUpperCase() + d.verdict.slice(1))}</p>${reasons}${cap ? `<p class="cap">${cap}</p>` : ""}${tx}`;
}

/* ---------------- on-chain ledger ---------------- */
const events = new Map();       // key -> decoded event
const stamps = new Map();       // block number -> unix seconds
let lastBlock = CONFIG.deployBlock - 1;
let firstLoad = true;

async function rpc(method, params) {
  let lastErr;
  for (const url of CONFIG.rpcs) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function blockTime(n) {
  if (stamps.has(n)) return stamps.get(n);
  const b = await rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false]);
  const t = Number(BigInt(b.timestamp));
  stamps.set(n, t);
  return t;
}

async function poll() {
  const status = $("status");
  try {
    const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
    const fresh = [];
    for (let from = lastBlock + 1; from <= latest; from += CONFIG.chunk) {
      const to = Math.min(from + CONFIG.chunk - 1, latest);
      const logs = await rpc("eth_getLogs", [{ address: CONFIG.registry, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16), topics: [[ATTESTED, LINKED]] }]);
      for (const log of logs) {
        const ev = decodeLog(log);
        if (!ev) continue;
        const key = ev.tx + ":" + ev.logIndex;
        if (events.has(key)) continue;
        if (log.blockTimestamp) stamps.set(ev.block, Number(BigInt(log.blockTimestamp)));
        events.set(key, ev);
        fresh.push(key);
      }
    }
    lastBlock = latest;
    for (const ev of events.values()) ev.ts = await blockTime(ev.block).catch(() => null);
    render(new Set(firstLoad ? [] : fresh));
    firstLoad = false;
    status.className = "status";
    status.textContent = "Updates every 15 seconds.";
  } catch (e) {
    status.className = "status err";
    status.textContent = "Could not read the testnet right now. Retrying.";
  }
}

function render(freshKeys) {
  const all = [...events.entries()].sort((a, b) => b[1].block - a[1].block || b[1].logIndex - a[1].logIndex);
  const checks = all.filter(([, e]) => e.kind === "attested");
  const blocked = checks.filter(([, e]) => e.verdict === "block").length;
  const warned = checks.filter(([, e]) => e.verdict === "warn").length;
  $("summary").textContent = checks.length === 0
    ? "No checks recorded yet. Run one with the box ticked to record it on-chain."
    : `${checks.length} ${checks.length === 1 ? "check" : "checks"} recorded: ${blocked} blocked, ${warned} warned, ${checks.length - blocked - warned} allowed.`;

  const ul = $("ledger");
  ul.innerHTML = "";
  for (const [key, e] of all.slice(0, 40)) {
    const li = document.createElement("li");
    li.className = "row" + (freshKeys.has(key) ? " fresh" : "");
    const when = e.ts ? timeAgo(e.ts) : "";
    const link = `<a class="tx" href="${CONFIG.explorer}/tx/${e.tx}" target="_blank" rel="noopener">${esc(shortAddr(e.tx))}</a>`;
    if (e.kind === "attested") {
      li.dataset.verdict = e.verdict;
      li.innerHTML = `<span class="bar"></span><span class="what">${esc(cap1(e.verdict))}<span>${esc(REASON_TEXT[e.reason] || e.reason)}</span></span><span class="addr">${esc(shortAddr(e.target))}</span><span class="when">${esc(when)}</span>${link}`;
    } else {
      li.innerHTML = `<span class="bar" style="background:var(--ink)"></span><span class="what">Name linked<span>${esc(e.name)}.ai now points to agent ${esc(e.agentId)}</span></span><span class="addr">${esc(shortAddr(e.owner))}</span><span class="when">${esc(when)}</span>${link}`;
    }
    ul.appendChild(li);
  }
  renderFacts();
}

function renderFacts() {
  const link = [...events.values()].find((e) => e.kind === "linked");
  const addr = (a) => `<a class="addr" href="${CONFIG.explorer}/address/${a}" target="_blank" rel="noopener">${a}</a>`;
  $("facts").innerHTML = `
    <dt>Agent ID</dt><dd>${link ? esc(link.agentId) : "2880"} on the ERC-8004 Identity Registry</dd>
    <dt>Name</dt><dd>${link ? esc(link.name) + ".ai, linked on-chain" : "yinko.ai"}</dd>
    <dt>Yinko registry</dt><dd>${addr(CONFIG.registry)}</dd>
    <dt>Identity registry</dt><dd>${addr(CONFIG.identity)}</dd>`;
}

const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

renderFacts();
poll();
setInterval(poll, CONFIG.pollMs);
