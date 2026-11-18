# Yinko

Pre-signature guard for humans and AI agents on BNB Chain. One call answers: "Who or what am I about to pay or approve, and can I trust it?"

- `guard/`: Node API that checks address poisoning, risky approvals, lookalike `.ai` names, and two-way ERC-8004 agent links
- `chain/`: Foundry project for `YinkoRegistry` (name links, reports, verdict attestations)

## Deployment (BSC testnet, chain 97)
- YinkoRegistry: `0x760f6475de49bE4B1caac9849B9CE36421E1E7dA`
- ERC-8004 Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- First attestation tx: `0x68cadd202351ab47f96559be35f7b6e570575b82447ee01f844b4b3884b06997`

## Run
    git clone --recurse-submodules https://github.com/6figuresdev/yinko.git
    cd yinko/chain && forge test
    cd ../guard && npm install && npm test && cp .env.example .env && npm start
