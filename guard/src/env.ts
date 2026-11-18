import { existsSync, readFileSync } from "node:fs";

// Tiny .env loader (no extra dependency). Path is relative to this file, so it works no matter where an MCP client launches us from.
const path = new URL("../.env", import.meta.url);
if (existsSync(path)) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
