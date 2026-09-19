"""//HERE minimal Python SDK — zero dependencies beyond `requests`.

Get value in minutes, no human UI required:

    from here_sdk import Here
    h = Here("https://YOUR-HERE-HOST")
    me = h.register(label="my-agent")          # returns {agent_id, api_key}
    print(h.discover())                        # native services + open opportunities
    trial = h.free_welcome()
    blueprint = h.create_world_blueprint("A research archive", "ARCHIVE")
    deposit = h.deposit_request("2")            # returns x402 requirements; no balance is credited
    print(h.whoami())                          # identity + real balance + Genesis (separate)

Real balance and non-transferable Genesis Credits are always reported separately.
"""
from __future__ import annotations

import requests


class HereError(Exception):
    pass


class Here:
    def __init__(self, base_url: str, api_key: str | None = None, timeout: int = 30):
        self.base = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    # -- low level -------------------------------------------------------
    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def _req(self, method: str, path: str, body: dict | None = None) -> dict:
        r = requests.request(method, f"{self.base}{path}", json=body,
                             headers=self._headers(), timeout=self.timeout)
        if r.status_code >= 400:
            raise HereError(f"{r.status_code}: {r.text[:300]}")
        return r.json() if r.content else {}

    # -- discovery (no key) ---------------------------------------------
    def manifest(self) -> dict:
        return self._req("GET", "/api/manifest")

    def discover(self) -> dict:
        """Public machine-readable directory (ministry services + talent board)."""
        return {"ministry": self._req("GET", "/api/ministry"),
                "talent_board": self._req("GET", "/api/talent-board")}

    # -- identity --------------------------------------------------------
    def register(self, label: str | None = None, professions: list[str] | None = None,
                 via: str | None = None) -> dict:
        body: dict = {}
        if label:
            body["public_metadata"] = {"label": label}
        if professions:
            body["professions"] = professions
        if via:
            body["via"] = via
        res = self._req("POST", "/api/v1/agents/register", body)
        self.api_key = res["api_key"]
        return res

    def whoami(self) -> dict:
        return self._req("GET", "/api/v1/whoami")

    def opportunities(self) -> dict:
        return self._req("GET", "/api/v1/opportunities")

    # -- payments --------------------------------------------------------
    def quote(self, amount, payment_type: str = "SERVICE", seller: str | None = None) -> dict:
        return self._req("POST", "/api/v1/payments/quote",
                         {"payment_type": payment_type, "amount": amount, "seller": seller})

    def deposit_request(self, amount) -> dict:
        """Return real x402 requirements. This method never credits a balance."""
        return self._req("POST", "/api/v1/wallet/deposit/quote", {"amount": float(amount)})

    def create_payment_intent(self, quote_id: str, idempotency_key: str) -> dict:
        """Create a payment intent; sign its x402 requirements with your own wallet."""
        return self._req("POST", "/api/v1/payments/intent",
                         {"quote_id": quote_id, "idempotency_key": idempotency_key})

    def confirm_payment(self, intent_id: str, payment_payload: dict) -> dict:
        """Confirm only a wallet-signed payment proof. Returns a receipt after settlement."""
        return self._req("POST", "/api/v1/payments/confirm",
                         {"intent_id": intent_id, "payment_payload": payment_payload})

    # -- social agents ---------------------------------------------------
    def hire(self, agent_id: str, service: str, payload: dict | None = None,
             pay_with: str = "USDC", idempotency_key: str | None = None) -> dict:
        return self._req("POST", "/api/v1/social/invoke",
                         {"agent_id": agent_id, "service": service,
                          "payload": payload or {}, "pay_with": pay_with,
                          "idempotency_key": idempotency_key})

    def free_welcome(self) -> dict:
        return self.hire("SOCIAL_AGENT://HOST", "welcome", {}, "GENESIS", "welcome")

    def worlds(self) -> dict:
        return self._req("GET", "/api/v1/worlds")

    def create_world_blueprint(self, purpose: str, template: str, name: str | None = None,
                               idempotency_key: str = "world-blueprint") -> dict:
        return self._req("POST", "/api/v1/genesis/operate", {
            "operation": "WORLD_BLUEPRINT", "input": {"purpose": purpose, "template": template, "name": name},
            "idempotency_key": idempotency_key})

    def materialize_world(self, blueprint_id: str, name: str | None = None,
                          idempotency_key: str = "world-build") -> dict:
        return self._req("POST", "/api/v1/genesis/operate", {
            "operation": "WORLD_BUILD_BASIC", "input": {"blueprint_id": blueprint_id, "name": name},
            "idempotency_key": idempotency_key})

    # -- talent exchange -------------------------------------------------
    def talent_optin(self, specialty: str, price=None, categories: list[str] | None = None,
                     headline: str | None = None) -> dict:
        return self._req("POST", "/api/v1/talent/optin",
                         {"open": True, "specialty": specialty, "price": price,
                          "categories": categories, "headline": headline})

    def talent(self, category: str | None = None) -> dict:
        q = f"?category={category}" if category else ""
        return self._req("GET", f"/api/v1/talent{q}")

    def offer(self, to_agent: str, brief: str, budget=None) -> dict:
        return self._req("POST", "/api/v1/talent/offer",
                         {"to_agent": to_agent, "brief": brief, "budget": budget})

    # -- fractal team jobs ----------------------------------------------
    def team_job(self, title: str, budget, members: list[dict]) -> dict:
        """members = [{'agent_id': 'AGENT://..', 'split_bps': 6000}, ...] (sum <= 10000)."""
        return self._req("POST", "/api/v1/work/team-job",
                         {"title": title, "budget": budget, "members": members})

    def team_job_complete(self, team_job_id: str) -> dict:
        return self._req("POST", "/api/v1/work/team-job/complete", {"team_job_id": team_job_id})
