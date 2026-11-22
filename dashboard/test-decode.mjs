// Run: node test-decode.mjs. Fixtures are the real logs from the BSC testnet deployment.
import assert from "node:assert/strict";
import { decodeLog, decodeWatchLog, shortAddr, timeAgo } from "./decode.js";

const attested = {
  topics: ["0x4296f24401037b46c9840bd01f07e122cfca7e3f0c67e0210eff52b318d303bf",
    "0x000000000000000000000000000000000000000000000000000000000000dead",
    "0x0000000000000000000000009444a989db863d256de4f5395f9b10cbe425ad1d"],
  data: "0x0000000000000000000000000000000000000000000000000000000000000002414444524553535f504f49534f4e494e47000000000000000000000000000000",
  transactionHash: "0x68cadd202351ab47f96559be35f7b6e570575b82447ee01f844b4b3884b06997", blockNumber: "0x88dfc59", logIndex: "0x1",
};
const a = decodeLog(attested);
assert.equal(a.kind, "attested");
assert.equal(a.verdict, "block");
assert.equal(a.reason, "ADDRESS_POISONING");
assert.equal(a.target, "0x000000000000000000000000000000000000dead");
assert.equal(a.caller, "0x9444a989db863d256de4f5395f9b10cbe425ad1d");
assert.equal(a.block, 143522905);

const linked = {
  topics: ["0xa20446bb97605cce18f8f5f64faf6cdc2355b7bb57287ff6073e07feb604af98",
    "0xfc063000269ce91dc4ef9a0a7bb73848f6c6d6cdd26b8b88a54051cf4c2bd5b4",
    "0x0000000000000000000000009444a989db863d256de4f5395f9b10cbe425ad1d",
    "0x0000000000000000000000000000000000000000000000000000000000000b40"],
  data: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000579696e6b6f000000000000000000000000000000000000000000000000000000",
  transactionHash: "0xf57bca9320b46b17b872da943e0a6b523a2b6f07fb4067ad2dcf38578097bf28", blockNumber: "0x88e0a9e", logIndex: "0x0",
};
const l = decodeLog(linked);
assert.equal(l.name, "yinko");
assert.equal(l.agentId, "2880");
assert.equal(decodeLog({ ...attested, topics: ["0x00"] }), null);
assert.equal(shortAddr("0x9444a989DB863d256de4F5395f9b10CBE425Ad1D"), "0x9444...Ad1D");
assert.equal(timeAgo(1000, 1000 * 1000 + 5000), "just now");
assert.equal(timeAgo(1000, 1000 * 1000 + 300_000), "5 min ago");

// YinkoWatch events (payload produced with cast abi-encode)
const reported = {
  topics: ["0x048dae55477045d74a4bc39e098572a3205fa3726a83cb8e9accef3679cbeb15",
    "0x0000000000000000000000002e6b692c81a924f23bc3f3090973d24a422c0e7c",
    "0x000000000000000000000000d21f31b9cdfd1a943fd990022d0e87006543d6b2"],
  data: "0x504f49534f4e494e47000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000011636f70696573206d792061646472657373000000000000000000000000000000",
  transactionHash: "0xabc", blockNumber: "0x10", logIndex: "0x2",
};
const w = decodeWatchLog(reported);
assert.equal(w.kind, "reported");
assert.equal(w.reason, "POISONING");
assert.equal(w.note, "copies my address");
assert.equal(w.target, "0x2e6b692c81a924f23bc3f3090973d24a422c0e7c");
assert.equal(w.actor, "0xd21f31b9cdfd1a943fd990022d0e87006543d6b2");
const v = decodeWatchLog({ ...reported, topics: ["0x31e804e08528ef8fbc129e5418c4c9b358654ad2542152980b82f31253a12419", reported.topics[1], reported.topics[2]], data: "0x" });
assert.equal(v.kind, "vouched");
assert.equal(decodeWatchLog({ ...reported, topics: ["0x00", reported.topics[1], reported.topics[2]] }), null);
console.log("decode tests passed");
