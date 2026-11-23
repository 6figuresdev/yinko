import { ATTESTED, LINKED, WATCH_REPORTED, WATCH_VOUCHED, REASON_TEXT, decodeLog, decodeWatchLog, shortAddr, timeAgo } from "./decode.js";

const NETWORKS = {
  mainnet: {
    label: "BNB Smart Chain",
    rpcs: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com", "https://bsc-dataseed1.defibit.io"],
    registry: "0xdE93A1e641cD067Eb202dAF3666b1665b5915a44",
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    deployBlock: 134762218,
    explorer: "https://bscscan.com",
    // Only verdicts written by these wallets are shown (anyone can call attest). The guard wallet.
    attesters: ["0x2e6b692c81a924f23bc3f3090973d24a422c0e7c"],
    // Only a name link made by this address counts (anyone can call linkAgent for a free name): the wallet that owns yinko.ai.
    expectedOwner: "0xd21f31b9cdfd1a943fd990022d0e87006543d6b2",
    agentFallback: "pending registration",
    // YinkoWatch (reports and vouches from Agent ID holders). Fill both in after deploying it; the section stays hidden until then.
    watch: "0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1",
    watchDeployBlock: 135017474,
  },
  testnet: {
    label: "BNB Smart Chain testnet",
    rpcs: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545", "https://bsc-testnet-rpc.publicnode.com", "https://data-seed-prebsc-2-s1.bnbchain.org:8545"],
    registry: "0x760f6475de49bE4B1caac9849B9CE36421E1E7dA",
    identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    deployBlock: 143522632,
    explorer: "https://testnet.bscscan.com",
    attesters: ["0x9444a989db863d256de4f5395f9b10cbe425ad1d"],
    expectedOwner: "0x9444a989db863d256de4f5395f9b10cbe425ad1d",
    agentFallback: "2880",
    watch: "",
    watchDeployBlock: 0,
  },
};
const NET = new URLSearchParams(location.search).get("net") === "testnet" ? "testnet" : "mainnet";
const CONFIG = {
  ...NETWORKS[NET],
  defaultApi: "https://yinko.vercel.app",
  repo: "https://github.com/6figuresdev/yinko",
  pollMs: 15000,
  chunk: 20000,
};


const $ = (id) => document.getElementById(id);
document.getElementById("repo").href = CONFIG.repo;
document.querySelector("footer").textContent = `Built for the Binance Wallet and BNB Chain Agent ID Hackathon. Running on ${CONFIG.label}.`;

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

async function send(req) {
  if ($("attest").checked) req.attest = true;
  $("request").textContent = JSON.stringify(req, null, 2);
  const out = $("result");
  out.dataset.verdict = "";
  out.innerHTML = `<p class="empty">Checking...</p>`;
  try {
    const headers = { "content-type": "application/json" };
    const token = $("token").value.trim();
    if (token) headers["x-yinko-token"] = token;
    const res = await fetch(apiInput.value.trim().replace(/\/$/, "") + "/check", {
      method: "POST", headers, body: JSON.stringify(req),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "The guard returned an error.");
    showResult(data);
  } catch (e) {
    out.dataset.verdict = "";
    out.innerHTML = `<p class="empty">${esc(e.message && !/fetch|network|Failed/i.test(e.message) ? e.message : "Could not reach the guard at " + apiInput.value + ". Check the address in the guard API box.")}</p>`;
  }
}

async function run(i, btn) {
  presetList.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
  await send({ ...PRESETS[i].req });
}

/* ---- check your own payment: public addresses only, nothing is connected or signed ---- */
const ADDR = /^0x[0-9a-fA-F]{40}$/;
$("own-kind").addEventListener("change", () => {
  const approval = $("own-kind").value === "approval";
  $("own-calldata-row").hidden = !approval;
  for (const id of ["own-name-row", "own-amount-row", "own-known-row", "own-agents-row"]) $(id).hidden = approval;
});
$("own-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  presetList.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
  const from = $("own-from").value.trim(), to = $("own-to").value.trim();
  const kind = $("own-kind").value, calldata = $("own-calldata").value.trim();
  const fail = (m) => { const o = $("result"); o.dataset.verdict = ""; o.innerHTML = `<p class="empty">${esc(m)}</p>`; };
  if (!ADDR.test(from)) return fail("Your wallet address must start with 0x and have 40 more characters.");
  if (!ADDR.test(to)) return fail(kind === "approval" ? "The spender address must start with 0x and have 40 more characters." : "The recipient address must start with 0x and have 40 more characters.");
  const req = { from, to, kind };
  const amount = $("own-amount").value.trim(), name = $("own-name").value.trim();
  if (amount && kind === "transfer") req.amount = amount;
  if (name && kind === "transfer") req.agentName = name.replace(/\.ai$/i, "").toLowerCase();
  const known = $("own-known").value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const badKnown = known.find((x) => !ADDR.test(x));
  if (kind === "transfer" && badKnown) return fail("One of the addresses you paid before is not a valid address: " + badKnown.slice(0, 14) + "...");
  if (kind === "transfer" && known.length) req.knownAddresses = [...new Set(known)].slice(0, 50);
  const agents = [];
  for (const line of $("own-agents").value.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [rawName, addr] = line.split(/[\s=,:]+/);
    const nm = (rawName || "").replace(/\.ai$/i, "").toLowerCase();
    if (!/^[a-z0-9]{3,15}$/.test(nm) || !ADDR.test(addr || "")) {
      if (kind === "transfer") return fail('Trusted agents need a name (3 to 15 letters or numbers) and then an address, one per line. Check: "' + line.slice(0, 40) + '"');
    } else agents.push({ name: nm, address: addr });
  }
  if (kind === "transfer" && agents.length) req.knownAgents = agents.slice(0, 50);
  if (kind === "approval") {
    if (!/^0x[0-9a-fA-F]{136,}$/.test(calldata)) return fail("Paste the transaction data (it starts with 0x and is long) for the approval you are about to sign.");
    req.calldata = calldata;
  }
  send(req);
});

function showResult(d) {
  const out = $("result");
  out.dataset.verdict = d.verdict;
  const reasons = d.reasons.length
    ? `<ul>${d.reasons.map((r) => `<li>${esc(r.message)}</li>`).join("")}</ul>`
    : `<p class="empty">The recipient checked out. No warnings.</p>`;
  const cap = d.verdict === "block" ? "Do not sign. Suggested spend cap: 0."
    : d.suggestedCap ? `Suggested spend cap: ${esc(d.suggestedCap)}.` : "";
  const cs = d.communitySignals;
  const signals = cs && (cs.reports > 0 || cs.vouches > 0)
    ? `<p class="cap">Agent ID holders: ${cs.reports} ${cs.reports === 1 ? "report" : "reports"}, ${cs.vouches} ${cs.vouches === 1 ? "vouch" : "vouches"}.</p>` : "";
  const agentId = d.recipientHasAgentId === true ? `<p class="cap">The recipient holds an Agent ID.</p>` : "";
  let tx = "";
  if (d.attestationTx) {
    tx = String(d.attestationTx).startsWith("0x")
      ? `<p>Recorded on-chain: <a class="tx" href="${CONFIG.explorer}/tx/${esc(d.attestationTx)}" target="_blank" rel="noopener">${esc(shortAddr(d.attestationTx))}</a></p>`
      : `<p>On-chain record failed: ${esc(d.attestationTx)}</p>`;
  }
  out.innerHTML = `<p class="verdict">${esc(d.verdict[0].toUpperCase() + d.verdict.slice(1))}</p>${reasons}${cap ? `<p class="cap">${cap}</p>` : ""}${agentId}${signals}${tx}`;
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

/* ---- reading logs: start with big ranges, split when the RPC refuses, learn the size that works, and never blank the page ---- */
const hexBlock = (n) => "0x" + n.toString(16);
let adaptiveChunk = CONFIG.chunk;
async function logsAdaptive(address, topics, from, to) {
  try {
    return await rpc("eth_getLogs", [{ address, fromBlock: hexBlock(from), toBlock: hexBlock(to), topics }]);
  } catch (e) {
    if (to - from < 1000) throw e;
    const mid = Math.floor((from + to) / 2);
    const a = await logsAdaptive(address, topics, from, mid);
    const b = await logsAdaptive(address, topics, mid + 1, to);
    adaptiveChunk = Math.max(1000, Math.min(adaptiveChunk, mid - from + 1));   // both halves worked, so remember the smaller size
    return a.concat(b);
  }
}
async function collectLogs(address, topics, fromBlock, latest) {
  const logs = [];
  let complete = true, cursor = fromBlock;
  while (cursor <= latest) {
    const ranges = [];
    for (let k = 0; k < 3 && cursor <= latest; k++) { const end = Math.min(cursor + adaptiveChunk - 1, latest); ranges.push([cursor, end]); cursor = end + 1; }
    const results = await Promise.allSettled(ranges.map(([x, y]) => logsAdaptive(address, topics, x, y)));
    let failed = 0;
    for (const r of results) { if (r.status === "fulfilled") logs.push(...r.value); else { failed++; complete = false; } }
    if (failed === results.length) break;   // the RPC is refusing everything: stop and try again later
  }
  return { logs, complete };
}
let pollFails = 0, pollSkip = 0, watchFails = 0, watchSkip = 0;

/* ---- the name link is read straight from contract state (one call), not from scanning history ---- */
const NAME_HASH = "fc063000269ce91dc4ef9a0a7bb73848f6c6d6cdd26b8b88a54051cf4c2bd5b4"; // keccak256("yinko")
let linkInfo = null;
async function loadLink() {
  try {
    const out = await rpc("eth_call", [{ to: CONFIG.registry, data: "0xb2fccc7f" + NAME_HASH }, "latest"]);
    const h = String(out).replace(/^0x/, "");
    if (h.length >= 192) {
      const owner = "0x" + h.slice(24, 64);
      const agentId = BigInt("0x" + h.slice(64, 128)).toString();
      if (owner.toLowerCase() === CONFIG.expectedOwner && agentId !== "0") linkInfo = { name: "yinko", agentId };
    }
  } catch { /* keep whatever we had */ }
  renderFacts();
}

async function poll() {
  if (pollSkip > 0) { pollSkip--; return; }
  const status = $("status");
  try {
    const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
    const fresh = [];
    const { logs, complete } = await collectLogs(CONFIG.registry, [[ATTESTED, LINKED]], lastBlock + 1, latest);
    for (const log of logs) {
      const ev = decodeLog(log);
      if (!ev) continue;
      if (ev.kind === "attested" && CONFIG.attesters.length && !CONFIG.attesters.includes(ev.caller.toLowerCase())) continue;
      if (ev.kind === "linked" && ev.owner.toLowerCase() !== CONFIG.expectedOwner) continue;
      const key = ev.tx + ":" + ev.logIndex;
      if (events.has(key)) continue;
      if (log.blockTimestamp) stamps.set(ev.block, Number(BigInt(log.blockTimestamp)));
      events.set(key, ev);
      fresh.push(key);
    }
    if (complete) { lastBlock = latest; pollFails = 0; } else { pollFails++; pollSkip = Math.min(pollFails, 6); }
    for (const ev of events.values()) ev.ts = await blockTime(ev.block).catch(() => null);
    render(new Set(firstLoad ? [] : fresh));
    firstLoad = false;
    status.className = complete ? "status" : "status err";
    status.textContent = complete ? "Updates every 15 seconds." : "Part of the history could not be loaded. Retrying.";
  } catch (e) {
    status.className = "status err";
    status.textContent = "Could not read the chain right now. Retrying.";
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
  const link = linkInfo || [...events.values()].find((e) => e.kind === "linked");
  const addr = (a) => `<a class="addr" href="${CONFIG.explorer}/address/${a}" target="_blank" rel="noopener">${a}</a>`;
  $("facts").innerHTML = `
    <dt>Agent ID</dt><dd>${link ? esc(link.agentId) : esc(CONFIG.agentFallback)} on the ERC-8004 Identity Registry</dd>
    <dt>Name</dt><dd>${link ? esc(link.name) + ".ai, linked on-chain" : "yinko.ai (link pending)"}</dd>
    <dt>Yinko registry</dt><dd>${addr(CONFIG.registry)}</dd>
    <dt>Identity registry</dt><dd>${addr(CONFIG.identity)}</dd>`;
}

const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------------- signals from Agent ID holders (YinkoWatch) ---------------- */
const signalEvents = new Map();
let watchLast = CONFIG.watchDeployBlock - 1;
let watchFirst = true;

async function pollWatch() {
  if (!CONFIG.watch) return;
  if (watchSkip > 0) { watchSkip--; return; }
  $("signals").hidden = false;
  $("signals-nav").hidden = false;
  try {
    const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
    const fresh = new Set();
    const { logs, complete } = await collectLogs(CONFIG.watch, [[WATCH_REPORTED, WATCH_VOUCHED]], watchLast + 1, latest);
    for (const log of logs) {
      const ev = decodeWatchLog(log);
      if (!ev) continue;
      const key = ev.tx + ":" + ev.logIndex;
      if (signalEvents.has(key)) continue;
      if (log.blockTimestamp) stamps.set(ev.block, Number(BigInt(log.blockTimestamp)));
      signalEvents.set(key, ev);
      fresh.add(key);
    }
    if (complete) { watchLast = latest; watchFails = 0; } else { watchFails++; watchSkip = Math.min(watchFails, 6); }
    for (const ev of signalEvents.values()) ev.ts = await blockTime(ev.block).catch(() => null);
    renderSignals(watchFirst ? new Set() : fresh);
    watchFirst = false;
  } catch (e) {
    $("signals-summary").textContent = "Could not read the signals right now. Retrying.";
  }
}

function renderSignals(freshKeys) {
  const all = [...signalEvents.entries()].sort((a, b) => b[1].block - a[1].block || b[1].logIndex - a[1].logIndex);
  const holders = new Set(all.map(([, e]) => e.actor)).size;
  const reports = all.filter(([, e]) => e.kind === "reported").length;
  $("signals-summary").textContent = all.length === 0
    ? "Nothing here yet. Agent ID holders can report an address as unsafe or vouch for it."
    : `${holders} Agent ID ${holders === 1 ? "holder has" : "holders have"} taken part: ${reports} ${reports === 1 ? "report" : "reports"}, ${all.length - reports} ${all.length - reports === 1 ? "vouch" : "vouches"}.`;
  const ul = $("signals-ledger");
  ul.innerHTML = "";
  for (const [key, e] of all.slice(0, 40)) {
    const li = document.createElement("li");
    li.className = "row" + (freshKeys.has(key) ? " fresh" : "");
    li.dataset.verdict = e.kind === "reported" ? "warn" : "allow";
    const what = e.kind === "reported"
      ? `Reported<span>${esc(REASON_TEXT[e.reason] || e.reason)}${e.note ? ": " + esc(e.note) : ""}</span>`
      : `Vouched for<span>By an Agent ID holder</span>`;
    li.innerHTML = `<span class="bar"></span><span class="what">${what}</span><span class="addr">${esc(shortAddr(e.target))}</span><span class="when">${esc(e.ts ? timeAgo(e.ts) : "")}</span><a class="tx" href="${CONFIG.explorer}/tx/${e.tx}" target="_blank" rel="noopener">${esc(shortAddr(e.tx))}</a>`;
    ul.appendChild(li);
  }
}

/* ---- wallet guide: type your addresses once and every command fills in; nothing is sent anywhere ---- */
const PH = { wallet: "YOUR_WALLET_ADDRESS", to: "RECIPIENT_ADDRESS" };
function updatePlaceholders() {
  const w = $("wal-wallet").value.trim(), t = $("wal-to").value.trim();
  document.querySelectorAll(".ph").forEach((el) => {
    const v = el.dataset.ph === "wallet" ? w : t;
    el.textContent = ADDR.test(v) ? v : PH[el.dataset.ph];
  });
  if (ADDR.test(w)) $("own-from").value = w;
  if (ADDR.test(t)) $("own-to").value = t;
}
["wal-wallet", "wal-to"].forEach((id) => $(id).addEventListener("input", updatePlaceholders));
document.querySelectorAll("button.copy").forEach((b) => b.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($(b.dataset.copy).textContent); b.textContent = "Copied"; }
  catch { b.textContent = "Select the text and copy"; }
  setTimeout(() => { b.textContent = "Copy"; }, 1800);
}));

renderFacts();
loadLink();
poll();
pollWatch();
setInterval(poll, CONFIG.pollMs);
setInterval(loadLink, CONFIG.pollMs * 4);
setInterval(pollWatch, CONFIG.pollMs);
