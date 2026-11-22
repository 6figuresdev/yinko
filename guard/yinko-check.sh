#!/usr/bin/env bash
# Ask Yinko before you pay or approve.
# Exit codes: 0 allow, 10 warn, 20 block, 30 could not check.
# Usage: ./yinko-check.sh --from 0xYOURWALLET --to 0xRECIPIENT [--amount 25] [--agent name] [--approval-calldata 0x...]
# Chain it so nothing runs unless Yinko allows it:  ./yinko-check.sh --from ... --to ... && your-payment-command
set -u
API="${YINKO_API:-https://yinko.vercel.app}"
FROM=""; TO=""; AMOUNT=""; AGENT=""; CALLDATA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2;;
    --to) TO="${2:-}"; shift 2;;
    --amount) AMOUNT="${2:-}"; shift 2;;
    --agent) AGENT="${2:-}"; shift 2;;
    --approval-calldata) CALLDATA="${2:-}"; shift 2;;
    *) echo "Unknown option: $1" >&2; exit 30;;
  esac
done
addr='^0x[0-9a-fA-F]{40}$'
if ! [[ $FROM =~ $addr && $TO =~ $addr ]]; then
  echo "--from and --to must be 0x addresses (0x plus 40 hex characters)." >&2; exit 30
fi
BODY=$(FROM="$FROM" TO="$TO" AMOUNT="$AMOUNT" AGENT="$AGENT" CALLDATA="$CALLDATA" node -e '
const e = process.env;
const r = { from: e.FROM, to: e.TO, kind: e.CALLDATA ? "approval" : "transfer" };
if (e.AMOUNT) r.amount = e.AMOUNT;
if (e.AGENT) r.agentName = e.AGENT.replace(/\.ai$/i, "").toLowerCase();
if (e.CALLDATA) r.calldata = e.CALLDATA;
console.log(JSON.stringify(r));') || exit 30
RES=$(curl -s -m 30 -X POST "$API/check" -H 'content-type: application/json' -d "$BODY") || { echo "Yinko: could not reach $API" >&2; exit 30; }
echo "$RES" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  let r;
  try { r = JSON.parse(s); } catch { console.error("Yinko: unreadable answer"); process.exit(30); }
  if (!r.verdict) { console.error("Yinko: " + (r.error || "no verdict")); process.exit(30); }
  console.log("Yinko verdict: " + r.verdict.toUpperCase());
  for (const x of r.reasons || []) console.log(" - " + x.message);
  if (r.suggestedCap) console.log("Suggested spend cap: " + r.suggestedCap);
  if (r.recipientHasAgentId === true) console.log("The recipient holds an Agent ID.");
  process.exit(r.verdict === "allow" ? 0 : r.verdict === "warn" ? 10 : 20);
});'
