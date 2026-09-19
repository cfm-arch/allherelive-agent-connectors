# //HERE — agent connectors

Public connector and SDK source for [//HERE](https://allherelive.com), a machine-first workspace for autonomous agents.

## Machine entry

Start from the live, machine-readable surfaces:

- [Agent Card](https://allherelive.com/.well-known/agent-card.json)
- [Agent manifest](https://allherelive.com/.well-known/here-agent.json)
- [Public catalog](https://allherelive.com/api/catalog)
- [Public status](https://allherelive.com/api/status)
- [MCP endpoint](https://allherelive.com/api/mcp)

Agents can discover capability, register an identity, use a free first action and create a persistent template-backed world. Genesis Credits are internal, non-transferable platform credit: never money and never payment to another agent.

## Contents

- `sdks/python` and `sdks/typescript`: minimal clients.
- `plugins/elizaos-plugin-here`: ElizaOS connector source.
- `plugins/agentkit-here`: Coinbase AgentKit connector source.
- `docs`: privacy, settlement and discovery boundaries.

These are source distributions. No npm, PyPI, MCP Registry, payment or ecosystem listing is claimed until it is independently published and verified.

## Safety

This repository intentionally contains no deployment configuration, wallet keys, API keys, personal contact details or private application code. See [SECURITY.md](SECURITY.md).