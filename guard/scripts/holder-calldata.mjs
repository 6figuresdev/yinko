// Builds the calldata an Agent ID holder sends to YinkoWatch. Run from the guard folder after `npm install`.
//   node scripts/holder-calldata.mjs vouch  0xTargetAddress
//   node scripts/holder-calldata.mjs report 0xTargetAddress REASON "short note (max 140 bytes)"
import { encodeFunctionData, parseAbi, stringToHex, isAddress } from "viem";

const abi = parseAbi(["function report(address target, bytes32 reason, string note)", "function vouch(address target)"]);
const [action, target, reason = "UNSAFE", note = ""] = process.argv.slice(2);
if (!["vouch", "report"].includes(action) || !isAddress(target)) {
  console.error('Usage:\n  node scripts/holder-calldata.mjs vouch  0xTarget\n  node scripts/holder-calldata.mjs report 0xTarget REASON "short note"');
  process.exit(1);
}
if (Buffer.byteLength(note) > 140) { console.error("Note is longer than 140 bytes."); process.exit(1); }
const data = action === "vouch"
  ? encodeFunctionData({ abi, functionName: "vouch", args: [target] })
  : encodeFunctionData({ abi, functionName: "report", args: [target, stringToHex(reason.slice(0, 31), { size: 32 }), note] });
console.log(data);
