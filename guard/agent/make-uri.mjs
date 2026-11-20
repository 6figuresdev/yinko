// Prints a registration file as a data: URI (fully on-chain, no IPFS). Usage: node agent/make-uri.mjs [file]
import { readFileSync } from "node:fs";
const file = process.argv[2] ?? new URL("./registration.json", import.meta.url);
const json = JSON.stringify(JSON.parse(readFileSync(file, "utf8")));
console.log("data:application/json;base64," + Buffer.from(json).toString("base64"));
