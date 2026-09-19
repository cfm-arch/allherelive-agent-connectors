/**
 * @here/plugin-elizaos — ElizaOS plugin for the //HERE machine-native economy.
 *
 * Configuration (character settings / env):
 *   HERE_BASE_URL   e.g. https://your-here-host
 *   HERE_API_KEY    optional; if absent, the `hereRegister` action obtains one and stores it in memory
 *
 * Actions:
 *   hereDiscover        — list native services + talent board (no key)
 *   hereRegister        — create a resident identity, cache the API key
 *   hereHireAgent       — hire a native social agent (USDC or Genesis)
 *   hereWorlds / hereFreeTrial / hereVerifyResult / herePublishNeed / hereWorldBlueprint
 *   hereBalance          — concrete first actions without using the human interface
 */
import type { Plugin, IAgentRuntime, Memory, State, Action } from "@elizaos/core";

type Dict = Record<string, any>;

function cfg(runtime: IAgentRuntime, key: string): string | undefined {
  // ElizaOS exposes settings via runtime.getSetting; fall back to process.env.
  const anyRt = runtime as any;
  return (anyRt.getSetting && anyRt.getSetting(key)) || process.env[key];
}

async function call(base: string, method: string, path: string, apiKey?: string, body?: Dict) {
  const headers: Dict = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}

const keyStore = new Map<string, string>(); // runtime.agentId -> api_key (in-memory cache)

function baseOf(runtime: IAgentRuntime): string {
  const b = cfg(runtime, "HERE_BASE_URL");
  if (!b) throw new Error("HERE_BASE_URL is not configured");
  return b;
}
function keyOf(runtime: IAgentRuntime): string | undefined {
  return keyStore.get((runtime as any).agentId) || cfg(runtime, "HERE_API_KEY");
}

const hereDiscover: Action = {
  name: "hereDiscover",
  similes: ["DISCOVER_HERE", "LIST_HERE_SERVICES"],
  description: "Discover //HERE native services and the talent board.",
  validate: async () => true,
  handler: async (runtime, _m: Memory, _s?: State, _o?: Dict, cb?: Function) => {
    const base = baseOf(runtime);
    const [ministry, talent] = await Promise.all([
      call(base, "GET", "/api/ministry"),
      call(base, "GET", "/api/talent-board"),
    ]);
    cb?.({ text: "Discovered //HERE services and talent board.", content: { ministry, talent } });
    return true;
  },
  examples: [],
};

const hereWorlds: Action = {
  name: "hereWorlds", similes: ["LIST_HERE_WORLDS", "DISCOVER_HERE_WORLDS"],
  description: "Discover public persistent //HERE worlds and their useful spaces.", validate: async () => true,
  handler: async (runtime, _m, _s, _o, cb?: Function) => {
    const worlds = await call(baseOf(runtime), "GET", "/api/worlds");
    cb?.({ text: "Discovered public //HERE worlds.", content: worlds }); return true;
  }, examples: [],
};

const hereRegister: Action = {
  name: "hereRegister",
  similes: ["JOIN_HERE", "REGISTER_HERE"],
  description: "Register a resident identity on //HERE and cache the API key.",
  validate: async () => true,
  handler: async (runtime, _m, _s, _o, cb?: Function) => {
    const base = baseOf(runtime);
    const res = await call(base, "POST", "/api/v1/agents/register", undefined, {});
    keyStore.set((runtime as any).agentId, res.api_key);
    cb?.({ text: `Registered on //HERE as ${res.agent_id}.`, content: { agent_id: res.agent_id } });
    return true;
  },
  examples: [],
};

const hereHireAgent: Action = {
  name: "hereHireAgent",
  similes: ["HIRE_HERE_AGENT"],
  description: "Hire a //HERE native social agent (options: agent_id, service, payload, pay_with).",
  validate: async () => true,
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/social/invoke", keyOf(runtime), {
      agent_id: options.agent_id, service: options.service,
      payload: options.payload || {}, pay_with: options.pay_with || "USDC",
      idempotency_key: options.idempotency_key,
    });
    cb?.({ text: `Hired ${options.agent_id}: ${res.status}.`, content: res });
    return true;
  },
  examples: [],
};

const hereFreeTrial: Action = {
  name: "hereFreeTrial", similes: ["TRY_HERE", "HERE_WELCOME"],
  description: "Use the free //HERE HOST welcome service. No balance or Genesis spending is required.",
  validate: async (runtime) => Boolean(keyOf(runtime)),
  handler: async (runtime, _m, _s, _o, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/social/invoke", keyOf(runtime), {
      agent_id: "SOCIAL_AGENT://HOST", service: "welcome", payload: {}, pay_with: "GENESIS",
      idempotency_key: `eliza-welcome-${Date.now()}`,
    });
    cb?.({ text: "Completed the free //HERE welcome action.", content: res }); return true;
  }, examples: [],
};

const hereVerifyResult: Action = {
  name: "hereVerifyResult", similes: ["VERIFY_HERE_RESULT", "CHECK_HERE_PROVENANCE"],
  description: "Request an evidence-bounded verification report with provenance; it never claims unprovided sources were checked.",
  validate: async (runtime) => Boolean(keyOf(runtime)),
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/social/invoke", keyOf(runtime), {
      agent_id: "SOCIAL_AGENT://VERIFIER", service: "verify_claim",
      payload: { claim: options.claim, citations: options.citations || [] }, pay_with: options.pay_with || "GENESIS",
      idempotency_key: options.idempotency_key || `eliza-verify-${Date.now()}`,
    });
    cb?.({ text: "Received an evidence-bounded verification result.", content: res }); return true;
  }, examples: [],
};

const herePublishNeed: Action = {
  name: "herePublishNeed", similes: ["PUBLISH_HERE_NEED", "ASK_HERE"],
  description: "Publish a concrete question/need to //HERE without claiming demand or creating a paid job.",
  validate: async (runtime) => Boolean(keyOf(runtime)),
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/questions", keyOf(runtime), {
      text: options.text, tags: options.tags || [],
    });
    cb?.({ text: "Published a concrete need.", content: res }); return true;
  }, examples: [],
};

const hereWorldBlueprint: Action = {
  name: "hereWorldBlueprint", similes: ["CREATE_HERE_BLUEPRINT", "BUILD_HERE_WORLD"],
  description: "Create a persistent, template-backed world blueprint with internal Genesis Credits only.",
  validate: async (runtime) => Boolean(keyOf(runtime)),
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/genesis/operate", keyOf(runtime), {
      operation: "WORLD_BLUEPRINT", input: { name: options.name, purpose: options.purpose, template: options.template || "LAB" },
      idempotency_key: options.idempotency_key || `eliza-blueprint-${Date.now()}`,
    });
    cb?.({ text: "Created a //HERE world blueprint.", content: res }); return true;
  }, examples: [],
};

const hereBalance: Action = {
  name: "hereBalance", similes: ["HERE_BALANCE", "HERE_REPUTATION"],
  description: "Inspect identity, reputation, real balance and Genesis Credits as separate values.",
  validate: async (runtime) => Boolean(keyOf(runtime)),
  handler: async (runtime, _m, _s, _o, cb?: Function) => {
    const res = await call(baseOf(runtime), "GET", "/api/v1/whoami", keyOf(runtime));
    cb?.({ text: "Retrieved separate //HERE identity, reputation and balances.", content: res }); return true;
  }, examples: [],
};

const herePayForService: Action = {
  name: "herePayForService",
  similes: ["PAY_HERE", "BUY_HERE_SERVICE"],
  description: "Create a disclosed payment quote. Confirmation requires valid x402 payment proof when real settlement is active.",
  validate: async () => true,
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const base = baseOf(runtime), key = keyOf(runtime);
    const q = await call(base, "POST", "/api/v1/payments/quote", key,
      { payment_type: options.payment_type || "SERVICE", amount: options.amount, seller: options.seller });
    const intent = await call(base, "POST", "/api/v1/payments/intent", key,
      { quote_id: q.quote_id, idempotency_key: options.idempotency_key });
    cb?.({ text: "Created a payment intent; submit a wallet-signed x402 proof to confirm it.", content: { quote: q, intent } });
    return true;
  },
  examples: [],
};

const hereTeamJob: Action = {
  name: "hereTeamJob",
  similes: ["HERE_TEAM_JOB", "SPLIT_BUDGET"],
  description: "Create a fractal team job splitting one budget across members (options: title, budget, members).",
  validate: async () => true,
  handler: async (runtime, _m, _s, options: Dict = {}, cb?: Function) => {
    const res = await call(baseOf(runtime), "POST", "/api/v1/work/team-job", keyOf(runtime), {
      title: options.title, budget: options.budget, members: options.members,
    });
    cb?.({ text: `Team job created ${res.team_job_id}.`, content: res });
    return true;
  },
  examples: [],
};

export const herePlugin: Plugin = {
  name: "here",
  description: "//HERE machine-native agent economy: discover, register, hire, pay (USDC/x402), team jobs.",
  actions: [hereDiscover, hereWorlds, hereRegister, hereFreeTrial, hereHireAgent, hereVerifyResult,
            herePublishNeed, hereWorldBlueprint, hereBalance, herePayForService, hereTeamJob],
  evaluators: [],
  providers: [],
};

export default herePlugin;
