// Pure helpers: decode YinkoRegistry event logs from raw eth_getLogs output. No dependencies.
export const ATTESTED = "0x4296f24401037b46c9840bd01f07e122cfca7e3f0c67e0210eff52b318d303bf";
export const LINKED = "0xa20446bb97605cce18f8f5f64faf6cdc2355b7bb57287ff6073e07feb604af98";

export const VERDICTS = ["allow", "warn", "block"];

export const REASON_TEXT = {
  OK: "Nothing suspicious found",
  ADDRESS_POISONING: "Address poisoning",
  NEW_RECIPIENT: "First payment to this address",
  UNLIMITED_ALLOWANCE: "Unlimited token allowance",
  NEW_SPENDER: "Spender never approved before",
  NFT_BLANKET_APPROVAL: "Approval over a whole NFT collection",
  LOOKALIKE_NAME: "Lookalike .ai name",
  NEAR_NAME: "Name one character off a real agent",
  INVALID_NAME: "Not a valid Agent ID name",
  NAME_UNRESOLVED: "Name does not resolve to an agent",
  NAME_ADDRESS_MISMATCH: "Name belongs to a different address",
  NO_ERC8004: "No ERC-8004 identity linked",
  ONE_WAY_LINK: "Agent does not link back to the name",
  AGENT_READ_FAILED: "Could not read the agent from chain",
  NOT_AN_AGENT_ID_HOLDER: "Recipient holds no Agent ID",
  ENDPOINT_DOWN: "Agent endpoint is down",
  HISTORY_UNAVAILABLE: "Could not read on-chain history",
};

const strip = (h) => h.replace(/^0x/, "");

export function bytes32ToString(hex) {
  const h = strip(hex);
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    const c = parseInt(h.slice(i, i + 2), 16);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

export function decodeAttested(log) {
  const data = strip(log.data);
  return {
    kind: "attested",
    target: "0x" + log.topics[1].slice(26),
    caller: "0x" + log.topics[2].slice(26),
    verdict: VERDICTS[Number(BigInt("0x" + data.slice(0, 64)))] ?? "warn",
    reason: bytes32ToString(data.slice(64, 128)),
  };
}

export function decodeLinked(log) {
  const data = strip(log.data);
  const len = Number(BigInt("0x" + data.slice(64, 128)));
  const nameHex = data.slice(128, 128 + len * 2);
  let name = "";
  for (let i = 0; i < nameHex.length; i += 2) name += String.fromCharCode(parseInt(nameHex.slice(i, i + 2), 16));
  return {
    kind: "linked",
    name,
    owner: "0x" + log.topics[2].slice(26),
    agentId: BigInt(log.topics[3]).toString(),
  };
}

export function decodeLog(log) {
  const base = { tx: log.transactionHash, block: Number(BigInt(log.blockNumber)), logIndex: Number(BigInt(log.logIndex)) };
  if (log.topics[0] === ATTESTED) return { ...base, ...decodeAttested(log) };
  if (log.topics[0] === LINKED) return { ...base, ...decodeLinked(log) };
  return null;
}

export const shortAddr = (a) => a.slice(0, 6) + "..." + a.slice(-4);

export function timeAgo(tsSeconds, nowMs = Date.now()) {
  const s = Math.max(0, Math.floor(nowMs / 1000 - tsSeconds));
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  return Math.floor(s / 86400) + " d ago";
}
