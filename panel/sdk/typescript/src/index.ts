import type { paths } from "./schema"

export type { paths } from "./schema"

export type PanelClientOptions = {
  baseUrl: string
  token: string
}

type LoginBody = NonNullable<
  paths["/api/v1/auth/login"]["post"]["requestBody"]
>["content"]["application/json"]

type LoginResponse = paths["/api/v1/auth/login"]["post"]["responses"][200]["content"]["application/json"]

export class PanelClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(opts: PanelClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "")
    this.token = opts.token
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      throw new Error(typeof data?.message === "string" ? data.message : `HTTP ${res.status}`)
    }
    return data as T
  }

  login(
    username: string,
    password: string,
    opts?: { otp?: string; recoveryCode?: string },
  ): Promise<LoginResponse> {
    const body: LoginBody = {
      username,
      password,
      ...(opts?.otp ? { otp: opts.otp } : {}),
      ...(opts?.recoveryCode ? { recovery_code: opts.recoveryCode } : {}),
    }
    return this.request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  getUser() {
    return this.request<{ user: Record<string, unknown> }>("/api/v1/auth/user")
  }

  listDomains() {
    return this.request<{ domains: unknown[] }>("/api/v1/domains")
  }

  createDomain(body: { domain: string; slug?: string }) {
    return this.request<{ domain: unknown }>("/api/v1/domains", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  deleteDomain(id: number) {
    return this.request<{ message: string }>(`/api/v1/domains/${id}`, { method: "DELETE" })
  }

  listDatabases() {
    return this.request<{ databases: unknown[] }>("/api/v1/databases")
  }

  createDatabase(body: { name: string; engine?: string; hosting_account_id?: number }) {
    return this.request<{ database: unknown }>("/api/v1/databases", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  listApps() {
    return this.request<{ apps: unknown[] }>("/api/v1/apps")
  }

  listSites() {
    return this.request<Record<string, unknown>>("/api/v1/sites")
  }

  createSite(body: {
    slug: string
    domain: string
    product?: string
    channel?: string
    aliases?: string[]
    env?: Record<string, string>
  }) {
    return this.request<Record<string, unknown>>("/api/v1/sites", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  getPlatformStatus() {
    return this.request<Record<string, unknown>>("/api/v1/platform/status")
  }

  deleteSite(slug: string) {
    return this.request<Record<string, unknown>>(`/api/v1/sites/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    })
  }

  listMonitoringServices() {
    return this.request<{ services: unknown[] }>("/api/v1/monitoring/services")
  }

  listWebhooks() {
    return this.request<{ endpoints: unknown[] }>("/api/v1/webhooks")
  }

  createWebhook(body: { name: string; url: string; events: string[] }) {
    return this.request<{ endpoint: unknown }>("/api/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  deleteWebhook(id: number) {
    return this.request<{ message: string }>(`/api/v1/webhooks/${id}`, { method: "DELETE" })
  }

  listTokens() {
    return this.request<{ tokens: unknown[] }>("/api/v1/auth/tokens")
  }

  createToken(body: { name: string; abilities?: string[] }) {
    return this.request<{ token: string }>("/api/v1/auth/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  revokeToken(id: number) {
    return this.request<{ message: string }>(`/api/v1/auth/tokens/${id}`, { method: "DELETE" })
  }

  api<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: method.toUpperCase(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  }
}
