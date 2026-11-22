#!/usr/bin/env bash
# Preview a mainnet contract call, show what it does, ask for confirmation, then execute it
# before the preview expires. Usage: ./baw-run.sh <contract-address> <0x-calldata>
set -u
AW="${AW:?Set AW to your own Agentic Wallet address first (baw wallet address --json)}"
TO="${1:?contract address}"; DATA="${2:?calldata}"

# Yinko check first. Token approvals (approve, increaseAllowance, setApprovalForAll) go through the guard before any preview.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${DATA:0:10}" in
  0x095ea7b3|0x39509351|0xa22cb465)
    SPENDER="0x${DATA:34:40}"
    "$HERE/yinko-check.sh" --from "$AW" --to "$SPENDER" --approval-calldata "$DATA"; RC=$?
    if [ "$RC" -eq 20 ]; then echo "Yinko says BLOCK. Not previewing and not executing."; exit 1; fi
    if [ "$RC" -eq 30 ]; then echo "Yinko could not be reached. Continuing is your decision."; fi
    ;;
  *) echo "Yinko: this is a contract call, not a transfer or an approval, so no Yinko check applies." ;;
esac

OUT=""
for i in 1 2 3 4 5 6; do
  TRY=$(baw contract-call preview --binanceChainId 56 --from "$AW" --to "$TO" --value 0 --inputData "$DATA" --json 2>&1)
  if echo "$TRY" | grep -q '"success": true'; then OUT="$TRY"; break; fi
  echo "preview attempt $i failed: $(echo "$TRY" | grep -o '"message": "[^"]*"' | head -1)"; sleep 4
done
[ -z "$OUT" ] && { echo "No preview obtained. Nothing was executed."; exit 1; }

echo "$OUT" | node -e '
const d = JSON.parse(require("fs").readFileSync(0)).data;
console.log("");
console.log("type:            ", d.parsedTx.transactionType, "action", d.parsedTx.action);
console.log("contract:        ", d.parsedTx.contractAddress);
console.log("balance changes: ", JSON.stringify(d.simulationResult.balanceChanges));
console.log("authority:       ", JSON.stringify(d.simulationResult.authorityChanges), "allowances:", JSON.stringify(d.simulationResult.allowanceChanges));
console.log("risks:           ", JSON.stringify(d.risks.riskDetails), "| simulation error:", d.simulationResult.simulationErrorDetail);
console.log("expires:         ", new Date(d.expiresAt).toISOString());
'
echo "Expected contract: $TO   From: $AW"
read -r -p "Execute this call now? Type yes: " ANSWER
[ "$ANSWER" = "yes" ] || { echo "Cancelled. Nothing executed."; exit 0; }
ID=$(echo "$OUT" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).data.requestId)')
baw contract-call execute --requestId "$ID" --json
