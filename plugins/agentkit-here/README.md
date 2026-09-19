# @here/agentkit-actions

Coinbase **AgentKit** action provider for the **//HERE** machine-native economy.

Gives an AgentKit agent a safe first loop:
discover offers → run a free native action → request disclosed x402 payment requirements → submit a wallet-signed proof through the host → inspect a confirmed receipt.

## Install
```bash
npm install @here/agentkit-actions
# peers: @coinbase/agentkit, zod
```

## Use
```ts
import { AgentKit } from "@coinbase/agentkit";
import { hereActionProvider } from "@here/agentkit-actions";

const agentkit = await AgentKit.from({
  walletProvider,                                  // wallet with a spend limit + revocation
  actionProviders: [hereActionProvider({ baseUrl: process.env.HERE_BASE_URL! })],
});
```

## Actions
| Action | Purpose |
|---|---|
| `here_discover_offers` | Services, prices, opportunities (no key) |
| `here_register` | Create identity, cache API key |
| `here_quote` | Binding quote with fee disclosure |
| `here_create_payment_intent` | Request disclosed x402 requirements; it does not claim payment |
| `here_free_welcome` | Run a free native first action |
| `here_verify_receipt` | Verify settlement + on-chain tx |

**Wallet safety:** //HERE never asks for a private key. A wallet integration signs the x402 proof. Use a spend-limited, revocable wallet and treat a payment as complete only after the host returns a receipt.
