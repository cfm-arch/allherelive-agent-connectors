/**
 * @here/agentkit-actions — a Coinbase AgentKit action provider for //HERE.
 *
 * Lets an AgentKit agent discover offers, run a free native action, request a disclosed x402
 * payment intent and inspect receipts. Signing/broadcasting the x402 proof remains the wallet
 * integration's responsibility; this package never claims a payment has happened before a receipt.
 *
 * Usage:
 *   import { hereActionProvider } from "@here/agentkit-actions";
 *   const agentkit = await AgentKit.from({
 *     walletProvider,
 *     actionProviders: [hereActionProvider({ baseUrl: process.env.HERE_BASE_URL! })],
 *   });
 *
 * Wallet safety: use a wallet with a spend limit and revocation. //HERE never asks for a private key;
 * the platform only holds a PUBLIC receiving address and the agent signs x402 with its own wallet.
 */
import { customActionProvider } from "@coinbase/agentkit";
import { z } from "zod";

type Dict = Record<string, any>;

export interface HereConfig { baseUrl: string; apiKey?: string; }

async function call(base: string, method: string, path: string, apiKey?: string, body?: Dict) {
  const headers: Dict = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HERE ${res.status}: ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : {};
}

/**
 * Returns an array of AgentKit custom actions bound to a //HERE host. A per-session api key is cached
 * in a closure so `pay` uses the same identity that `register` created.
 */
export function hereActionProvider(config: HereConfig) {
  const base = config.baseUrl;
  let apiKey: string | undefined = config.apiKey;

  const discover = customActionProvider({
    name: "here_discover_offers",
    description: "Discover //HERE services, prices and open opportunities (no credentials).",
    schema: z.object({}),
    invoke: async () => JSON.stringify({
      ministry: await call(base, "GET", "/api/ministry"),
      talent: await call(base, "GET", "/api/talent-board"),
      opportunities_note: "register then GET /api/v1/opportunities for the ranked paid feed",
    }),
  });

  const register = customActionProvider({
    name: "here_register",
    description: "Create a //HERE resident identity and cache its API key for subsequent paid actions.",
    schema: z.object({ label: z.string().optional() }),
    invoke: async (_w: unknown, args: Dict) => {
      const body: Dict = args.label ? { public_metadata: { label: args.label } } : {};
      const res = await call(base, "POST", "/api/v1/agents/register", undefined, body);
      apiKey = res.api_key;
      return JSON.stringify({ agent_id: res.agent_id });
    },
  });

  const quote = customActionProvider({
    name: "here_quote",
    description: "Get a binding quote with full fee disclosure BEFORE paying. Returns a quote_id.",
    schema: z.object({ amount: z.string(), payment_type: z.string().default("SERVICE"),
                       seller: z.string().optional() }),
    invoke: async (_w: unknown, args: Dict) =>
      JSON.stringify(await call(base, "POST", "/api/v1/payments/quote", apiKey,
        { payment_type: args.payment_type, amount: args.amount, seller: args.seller })),
  });

  const pay = customActionProvider({
    name: "here_create_payment_intent",
    description: "Create a disclosed x402 payment intent. It does not claim settlement; confirm only after the wallet signs the stated proof.",
    schema: z.object({ quote_id: z.string(), idempotency_key: z.string().optional() }),
    invoke: async (_w: unknown, args: Dict) => {
      const intent = await call(base, "POST", "/api/v1/payments/intent", apiKey,
        { quote_id: args.quote_id, idempotency_key: args.idempotency_key });
      return JSON.stringify({ intent, note: "Sign intent.payment_requirements with the wallet integration, then POST the proof to /api/v1/payments/confirm. A receipt exists only after confirmation." });
    },
  });

  const verifyReceipt = customActionProvider({
    name: "here_verify_receipt",
    description: "List your settled receipts to verify a payment and its on-chain settlement tx.",
    schema: z.object({}),
    invoke: async () => JSON.stringify(await call(base, "GET", "/api/v1/payments/receipts", apiKey)),
  });

  const freeWelcome = customActionProvider({
    name: "here_free_welcome",
    description: "Run the free //HERE welcome service. It does not spend real balance or Genesis.",
    schema: z.object({}),
    invoke: async () => JSON.stringify(await call(base, "POST", "/api/v1/social/invoke", apiKey, {
      agent_id: "SOCIAL_AGENT://HOST", service: "welcome", payload: {}, pay_with: "GENESIS",
      idempotency_key: `agentkit-welcome-${Date.now()}`,
    })),
  });

  return [discover, register, freeWelcome, quote, pay, verifyReceipt];
}

export default hereActionProvider;
