# For Agent ID holders: report or vouch for an address

Yinko is a hackathon entry: a pre-signature guard that tells people and AI agents whether a recipient is safe to pay. `YinkoWatch` is its on-chain signal from Agent ID holders. If you hold an Agent ID (a `name.ai` on your Agentic Wallet), you can report an address you know is unsafe, or vouch for one you trust. Yinko reads these signals when it checks a payment.

Made by 6figuresdev. Code: https://github.com/6figuresdev/yinko. Contract: `0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1` on BNB Smart Chain (source verified on BscScan, no owner, no admin functions, holds no funds).

## What you sign

- **One call** to `YinkoWatch`: `vouch(address)` or `report(address, reason, note)`.
- **0 BNB sent.** You pay only gas, a fraction of a cent.
- **No approval**, no token transfer, no access to your funds.
- **Public and permanent.** The signal and your wallet address are visible on-chain and cannot be undone. One signal per address per holder.
- Your Agent ID is checked on-chain. Without one, the call fails.

## What we will never ask you for

Your seed phrase, private key, API secret, pairing code or a QR-code login, in any form or by any message. There is no reward for taking part and no promised return. If anyone claiming to be Yinko asks for any of that, it is not us.

## Steps (Binance Agentic Wallet, Developer Mode)

You need Node 22+, and Developer Mode enabled in the Binance app (Agentic Wallet, Settings). It expires after a while and needs a confirmation per call, so turn it off again afterwards. If the app's "Abnormal Transactions" setting is on Auto Reject, a call to a new contract can be blocked, and "Need Confirmation" lets it through.

1. Install and sign in (this is Binance's own sign-in for your wallet):
   ```bash
   npm i -g @binance/agentic-wallet
   baw auth signin
   baw wallet address --json
   ```
2. Get this repository and build the call:
   ```bash
   git clone https://github.com/6figuresdev/yinko.git && cd yinko/guard && npm install
   export WATCH=0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1
   export AW=<your Agentic Wallet address from step 1>
   # Vouch for an address:
   DATA=$(node scripts/holder-calldata.mjs vouch 0xADDRESS)
   # Or report one (reason is a short code, the note is at most 140 bytes):
   DATA=$(node scripts/holder-calldata.mjs report 0xADDRESS POISONING "copies an address I used")
   ```
3. Preview, read, confirm, and send. The helper shows what the call does before it asks you:
   ```bash
   ./baw-run.sh $WATCH $DATA
   ```
   Check that the contract matches `0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1`, that no balance or allowance changes are listed, and that no risks appear. Type `yes` only if all of that matches.

## Why this is safe to read first

The whole contract is about 100 lines and is verified on BscScan. Its only state-changing functions are `report` and `vouch`.
