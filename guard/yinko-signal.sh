#!/usr/bin/env bash
# Vouch for, or report, an address on YinkoWatch from a Binance Agentic Wallet that holds an Agent ID.
# Usage:
#   ./yinko-signal.sh vouch  0xTARGET
#   ./yinko-signal.sh report 0xTARGET REASON "short note (max 140 bytes)"
# It checks that your wallet holds an Agent ID, shows the Binance preview, and asks you to type yes before anything is sent.
# Needs: baw (signed in, Developer Mode on in the Binance app) and node. No other install.
set -u
WATCH="${YINKO_WATCH:-0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1}"
RPC="${YINKO_RPC:-https://bsc-dataseed.bnbchain.org}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="${1:-}"; TARGET="${2:-}"; REASON="${3:-UNSAFE}"; NOTE="${4:-}"
addr='^0x[0-9a-fA-F]{40}$'

if [ "$ACTION" != "vouch" ] && [ "$ACTION" != "report" ] || ! [[ $TARGET =~ $addr ]]; then
  echo 'Usage: ./yinko-signal.sh vouch 0xTARGET   |   ./yinko-signal.sh report 0xTARGET REASON "short note"' >&2; exit 2
fi
if [ "$(printf '%s' "$NOTE" | wc -c)" -gt 140 ]; then echo "The note is longer than 140 bytes." >&2; exit 2; fi

# calldata built with plain node, no packages
CALLDATA=$(ACTION="$ACTION" TARGET="$TARGET" REASON="$REASON" NOTE="$NOTE" node -e '
const e = process.env, pad = (h) => h.padStart(64, "0"), t = e.TARGET.slice(2).toLowerCase();
if (e.ACTION === "vouch") { console.log("0xdd66e16b" + pad(t)); process.exit(0); }
const reason = Buffer.from(e.REASON.slice(0, 31)).toString("hex").padEnd(64, "0");
const note = Buffer.from(e.NOTE), len = pad(note.length.toString(16));
const body = note.toString("hex").padEnd(Math.ceil(note.length / 32) * 64, "0");
console.log("0x4c1b0efc" + pad(t) + reason + pad("60") + len + body);')
if [ "${5:-}" = "--calldata-only" ] || [ "${3:-}" = "--calldata-only" ]; then echo "$CALLDATA"; exit 0; fi

# the wallet: from AW, or ask baw
if [ -z "${AW:-}" ]; then
  AW=$(baw wallet address --json 2>/dev/null | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
fi
if ! [[ ${AW:-} =~ $addr ]]; then echo "Could not read your wallet address. Run: export AW=YOUR_AGENTIC_WALLET_ADDRESS" >&2; exit 2; fi
echo "Wallet:  $AW"
echo "Action:  $ACTION on $TARGET"
echo "Contract: $WATCH (YinkoWatch, BNB Smart Chain)"
[ "${AW,,}" = "${TARGET,,}" ] && { echo "You cannot signal your own address."; exit 1; }

# read the chain first, so a failing call never reaches Developer Mode
call() { node -e '
const [rpc, to, data] = process.argv.slice(1);
fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }) })
  .then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error.message); console.log(j.result); })
  .catch((e) => { console.error(e.message); process.exit(1); });' "$RPC" "$WATCH" "$1"; }
W32=$(printf '%064s' "${AW:2}" | tr ' ' 0 | tr 'A-F' 'a-f'); T32=$(printf '%064s' "${TARGET:2}" | tr ' ' 0 | tr 'A-F' 'a-f')
HOLDER=$(call "0xda0c34b0$W32") || { echo "Could not read the chain from $RPC. Try again, or set YINKO_RPC." >&2; exit 3; }
if [ "$((16#${HOLDER: -1}))" -ne 1 ]; then echo "This wallet does not hold an Agent ID, so YinkoWatch would reject the call. Nothing was sent."; exit 1; fi
DONE=$(call "0x053e6bb2$W32$T32" 2>/dev/null) && [ "$((16#${DONE: -1}))" -ne 0 ] && { echo "You have already signalled this address. One signal per address. Nothing was sent."; exit 1; }
S=$(call "0x99275d00$T32" 2>/dev/null) && echo "Before:  reports $((16#${S:2:64}))   vouches $((16#${S:66:64}))"
echo

AW="$AW" "$HERE/baw-run.sh" "$WATCH" "$CALLDATA"; RC=$?
if [ "$RC" -eq 0 ]; then
  echo; echo "If it said BROADCASTED, your signal is on-chain. Check the counts (give it a few seconds):"
  echo "  https://bscscan.com/address/$WATCH#readContract  ->  signalsOf  ->  $TARGET"
fi
exit "$RC"
