# Yinko

**Check before you sign.** Yinko is a pre-signature guard for people and AI agents on BNB Chain. One call answers: *who or what am I about to pay or approve, and can I trust it?* It returns `allow`, `warn` or `block`, the reasons in plain language, and a suggested spend cap.

Built for the Binance Wallet x BNB Chain Agent ID Hackathon.

- Live API: https://yinko.vercel.app (`GET /health`, `POST /check`)
- Guard agent: ERC-8004 agent **420531** on BNB Smart Chain, owned by the wallet that owns **yinko.ai**
- Dashboard: https://yinko-dashboard.vercel.app

## Why

Agent IDs turn wallet addresses into short names, and short names can be faked. A name that swaps `l` for `1` or `o` for `0` looks identical on screen. Address poisoning has the same shape: an attacker's address copies the first and last characters of one you have used. People and agents both sign what they cannot read. Yinko is the check that happens before the signature.

## What it checks

| Check | What Yinko catches |
|---|---|
| Address poisoning | A recipient that matches the first and last 4 characters of an address you have paid, but is a different address |
| Approvals | Unlimited allowances, spenders you have never approved, blanket NFT approvals. Decoded from the transaction data in plain language |
| Lookalike `.ai` names | `y1nko.ai` vs `yinko.ai`, and names one character away from a known agent |
| Two-way agent link | The name resolves to the address being paid, the address owns an ERC-8004 agent, and the agent's registration file points back to the same name |
| Live endpoint | The agent's declared endpoint answers |
| Agent ID holder | Whether the recipient's wallet holds an Agent ID (read on-chain from the Agent ID registry) |
| Reports from Agent ID holders | Addresses reported as unsafe by Agent ID holders through `YinkoWatch`: one report warns, two block |

## Try it

A poisoned address is blocked:

```bash
curl -s -X POST https://yinko.vercel.app/check -H 'content-type: application/json' -d '{
  "from": "0x9444a989DB863d256de4F5395f9b10CBE425Ad1D",
  "to": "0xA1b2000000000000000000000000000000005678",
  "kind": "transfer", "amount": "100",
  "knownAddresses": ["0xA1b2c3d4e5f60718293a4b5c6d7e8f9012345678"]
}'
```

The verified agent `yinko.ai` passes. The guard reads agent 420531 from BNB Smart Chain, fetches its registration file, and confirms the link points back:

```bash
curl -s -X POST https://yinko.vercel.app/check -H 'content-type: application/json' -d '{
  "from": "0x1111111111111111111111111111111111111111",
  "to": "0xd21f31b9cdfd1a943fd990022d0e87006543d6b2",
  "kind": "transfer", "agentName": "yinko",
  "knownAddresses": ["0xd21f31b9cdfd1a943fd990022d0e87006543d6b2"]
}'
```

Response shape: `{ "verdict": "allow|warn|block", "reasons": [{ "code", "severity", "message" }], "suggestedCap": "..." }`

## For agents: MCP tool

Yinko ships an MCP server with one tool, `yinko_check`. Its description tells the agent to call it before any payment or approval and never to proceed on `block`.

```json
{
  "mcpServers": {
    "yinko": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/yinko/guard/src/mcp-stdio.ts"]
    }
  }
}
```

## On-chain

Everything below is on BNB Smart Chain mainnet (chain 56). Source verified on BscScan: https://bscscan.com/address/0xdE93A1e641cD067Eb202dAF3666b1665b5915a44#code

| Item | Value |
|---|---|
| YinkoRegistry | `0xdE93A1e641cD067Eb202dAF3666b1665b5915a44` (deployed at block 134762218) |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| YinkoWatch (Agent ID-gated reports and vouches) | `0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1` ([source verified](https://bscscan.com/address/0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1#code)) |
| Agent ID registry (SPACE ID) | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` |
| Guard agent ID | `420531` |
| Agent owner / yinko.ai wallet | `0xd21f31b9cdfd1a943fd990022d0e87006543d6b2` |
| Agent registration tx | `0x9d7cf5d71c040f43d22df28d7a22213298dfb12644a0d24f5c707fcba186afaa` |
| Name link tx (`linkAgent("yinko", 420531)`) | `0x860ce55488084869b89773b06821b391d97b96a6cc9d9473c06a3163d9dd2ec5` |

`YinkoRegistry` records three things: name links (only the owner of an ERC-8004 agent can link a name to it), scam reports, and guard verdict attestations that feed the dashboard. The agent's registration file is stored fully on-chain as a data URI, and the registration was made by the Agentic Wallet itself through Binance's `baw` CLI, so the name, the wallet, the agent and the link all belong to one address.

A development deployment on BSC testnet (registry `0x760f6475de49bE4B1caac9849B9CE36421E1E7dA`, agent 2880) is kept for testing. Add `?net=testnet` to the dashboard URL to view it.

## How Agent ID is used

1. **Gate:** `YinkoWatch.report()` and `YinkoWatch.vouch()` revert unless the caller holds an Agent ID (`balanceOf(msg.sender) > 0` on the Agent ID registry). Only verified agents can flag or vouch for an address, so reports cannot be spammed from throwaway wallets. Agent IDs are non-transferable, and each holder gets one signal per address.
2. **Signal the guard acts on:** `/check` reads `YinkoWatch.signalsOf(recipient)`. One report warns, two reports from distinct holders block, and vouches are shown but never hide a report.
3. **Identity check:** `/check` reads the Agent ID registry for the recipient and returns `recipientHasAgentId`. Paying an address as `name.ai` when that address holds no Agent ID raises a warning.
4. **Two-way agent link:** `yinko.ai` belongs to the Agentic Wallet that also owns the guard's ERC-8004 agent (420531) and made the name link on `YinkoRegistry`.
5. **No name lookup:** Yinko never turns a name into a wallet. You supply both the name and the address, and it answers whether they belong together. Reports and vouches are about addresses only.

How an Agent ID holder takes part: [docs/HOLDER-GUIDE.md](docs/HOLDER-GUIDE.md).

## Owner permissions

None. `YinkoRegistry` and `YinkoWatch` have no owner, no admin or upgrade functions, no fees, no pause, and hold no funds. Neither contract can move anyone's tokens or ask for approvals. `YinkoWatch` fixes the Agent ID registry address at deployment.

## Rules we follow

- No QR-code or pairing-code login, no stored sessions, no collection of seed phrases, keys or API secrets.
- Yinko only advises. Nothing it does bypasses a transaction confirmation.
- No promised returns and no rewards for signalling.
- The project name, domain and contracts do not use the words Binance or BNB.
- No account farming: Agent IDs are one per user and non-transferable, and `YinkoWatch` allows one signal per holder per address.

## Repository

```
chain/       Foundry project: YinkoRegistry.sol, YinkoWatch.sol, tests, deploy scripts
guard/       TypeScript guard: checks, HTTP API, MCP server, on-chain reads
dashboard/   Static dashboard: live demo and on-chain record
```

## Run it locally

```bash
git clone --recurse-submodules https://github.com/6figuresdev/yinko.git
cd yinko/chain && forge test                       # 14 contract tests
cd ../guard && npm install && npm test             # 15 guard tests
cp .env.example .env && npm start                  # API on :8787
cd ../dashboard && node test-decode.mjs && python3 -m http.server 8080
```

Guard settings live in `guard/.env.example`. Recording a verdict on-chain needs `GUARD_PRIVATE_KEY` and `YINKO_REGISTRY`. On the public API it also needs the `x-yinko-token` header to match `ATTEST_TOKEN`, so strangers cannot spend the guard wallet's gas.

## Limits, stated plainly

- `.ai` name matching uses a known-names list (`guard/data/names.json`) next to the on-chain checks. Live resolution of every Agent ID name is not implemented, so lookalike detection compares against known names only.
- Payment history comes from recent ERC-20 transfer logs. Native BNB sends are not logs, so wallets should pass their address book as `knownAddresses`.
- Anyone can write to `YinkoRegistry`. The dashboard therefore shows only verdicts from the guard's own wallet and only a name link made by the owner of yinko.ai.
- The contract is not audited.
- A payment-backed reputation score is not built yet.
- Reports and vouches are only as useful as the number of Agent ID holders who take part.
