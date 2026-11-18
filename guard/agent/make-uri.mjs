// Prints the registration file as a data: URI so the agent's metadata lives fully on-chain (no IPFS needed).
import { readFileSync } from "node:fs";
const json = JSON.stringify(JSON.parse(readFileSync(new URL("./registration.json", import.meta.url), "utf8")));
console.log("data:application/json;base64," + Buffer.from(json).toString("base64"));
