"""WebinoServer panel API client."""

from __future__ import annotations

from typing import Any

import httpx


class PanelClient:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        with httpx.Client(base_url=self.base_url, headers=self._headers(), timeout=30.0) as client:
            res = client.request(method, path, **kwargs)
            res.raise_for_status()
            if not res.content:
                return None
            return res.json()

    def login(
        self,
        username: str,
        password: str,
        *,
        otp: str | None = None,
        recovery_code: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"username": username, "password": password}
        if otp:
            payload["otp"] = otp
        if recovery_code:
            payload["recovery_code"] = recovery_code
        with httpx.Client(base_url=self.base_url, timeout=30.0) as client:
            res = client.post("/api/v1/auth/login", json=payload)
            res.raise_for_status()
            return res.json()

    def get_user(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/auth/user")

    def list_domains(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/domains")

    def create_domain(self, domain: str, slug: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"domain": domain}
        if slug:
            body["slug"] = slug
        return self._request("POST", "/api/v1/domains", json=body)

    def delete_domain(self, domain_id: int) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/domains/{domain_id}")

    def list_databases(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/databases")

    def create_database(self, name: str, engine: str = "mysql") -> dict[str, Any]:
        return self._request("POST", "/api/v1/databases", json={"name": name, "engine": engine})

    def list_apps(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/apps")

    def list_monitoring_services(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/monitoring/services")

    def list_webhooks(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/webhooks")

    def create_webhook(self, name: str, url: str, events: list[str]) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/webhooks",
            json={"name": name, "url": url, "events": events},
        )

    def delete_webhook(self, endpoint_id: int) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/webhooks/{endpoint_id}")

    def list_tokens(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/auth/tokens")

    def create_token(self, name: str, abilities: list[str] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"name": name}
        if abilities:
            body["abilities"] = abilities
        return self._request("POST", "/api/v1/auth/tokens", json=body)

    def revoke_token(self, token_id: int) -> dict[str, Any]:
        return self._request("DELETE", f"/api/v1/auth/tokens/{token_id}")

    def api(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        kwargs: dict[str, Any] = {}
        if body is not None:
            kwargs["json"] = body
        return self._request(method.upper(), path, **kwargs)
