# For Agent ID holders: report or vouch for an address

Yinko is a hackathon entry: a check that tells people and AI agents whether a recipient is safe to pay. **YinkoWatch** is its on-chain signal from Agent ID holders. If you hold an Agent ID (a `name.ai` on your Binance Agentic Wallet), you can report an address you know is unsafe, or vouch for one you trust. Yinko reads these signals when it checks a payment: one report warns, two block, and vouches are shown but never hide a report.

Made by 6figuresdev. Code: https://github.com/6figuresdev/yinko. Contract: `0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1` on BNB Smart Chain. The source is verified on BscScan, there is no owner and no admin function, and it holds no funds.

## Why there is no website button

An Agentic Wallet lives in the Binance app and has no browser extension, and an Agent ID cannot be moved to another wallet. A web page cannot reach it. The only way an Agent ID holder can call a contract is Binance's `baw` tool in Developer Mode. This guide makes that one command.

## What you sign

- **One call** to YinkoWatch: `vouch(address)` or `report(address, reason, note)`.
- **0 BNB sent.** You pay only gas, a fraction of a cent.
- **No approval, no token transfer, no access to your funds.**
- **Public and permanent.** The signal and your wallet address are visible on-chain and cannot be undone. One signal per address per holder.
- Your Agent ID is checked on-chain. Without one the call fails, and the script tells you before anything is sent.

## What we will never ask you for

Your seed phrase, private key, API secret, pairing code or a QR login, in any form and by any message. There is no reward for taking part and no promised return. If anyone claiming to be Yinko asks for any of that, it is not us.

## Steps

You need Node 22 or newer and your Binance app.

1. **Install `baw` and sign in** (this is Binance's own sign-in for your wallet):
   ```bash
   npm i -g @binance/agentic-wallet
   baw auth signin
   ```
2. **Turn on Developer Mode** in the Binance app (Agentic Wallet, Settings). It expires after a while and asks for a confirmation per call. Turn it off again afterwards.
3. **Get the code:**
   ```bash
   git clone https://github.com/6figuresdev/yinko.git && cd yinko/guard
   ```
4. **Send your signal.** Pick one:
   ```bash
   ./yinko-signal.sh vouch  0xADDRESS_YOU_TRUST
   ./yinko-signal.sh report 0xADDRESS_YOU_DISTRUST REASON "short note, at most 140 bytes"
   ```
   For example: `./yinko-signal.sh report 0x... POISONING "copies an address I used"`.
5. **Read what it shows, then decide.** The script prints your wallet, the action and the contract, checks on-chain that your wallet holds an Agent ID and has not already signalled that address, shows the Binance preview, and waits. Check that the contract is `0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1` and that no balance or allowance changes and no risks are listed. Type `yes` only if all of that matches. Typing anything else sends nothing.
6. **Check it landed.** Open https://bscscan.com/address/0x42Fd66C871Ef9EeF67A6F3C55351aA7E75d826b1#readContract, choose `signalsOf`, and enter the address. You will see its report and vouch counts.

To rehearse without sending anything, run step 4 and type `no` at the confirmation.

## If something goes wrong

- **"This wallet does not hold an Agent ID":** the wallet `baw` is using is not the one that holds your Agent ID. Nothing was sent.
- **Binance blocks the call (code 351803):** a new contract can be flagged by Binance's risk check. In the app, change "Abnormal Transactions" from Auto Reject to Need Confirmation, then try again.
- **"Preview has expired":** run the command again and answer sooner.
- **`getaddrinfo EAI_AGAIN www.binance.com`:** your computer could not look up Binance's address. Try again, or switch to a public DNS server.

## Prefer to have your AI agent do it?

Give it `docs/HOLDER-AGENT-PROMPT.md`. It tells the agent to run only this script, to show you everything, and to wait for your explicit yes.

## Why it is safe to read first

The whole contract is about 100 lines and verified on BscScan. Its only state-changing functions are `report` and `vouch`.
