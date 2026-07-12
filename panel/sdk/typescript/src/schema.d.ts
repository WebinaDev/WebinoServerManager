/**
 * Generated from panel/backend/storage/app/openapi.json (Phase 28.10).
 * Regenerate: cd panel/backend && composer openapi
 */
export interface paths {
  "/api/v1/auth/login": {
    post: {
      requestBody?: { content: { "application/json": { username: string; password: string; otp?: string; recovery_code?: string } } }
      responses: {
        200: { content: { "application/json": { token: string } } }
        422: { content: { "application/json": { two_factor_required?: boolean; message?: string } } }
      }
    }
  }
  "/api/v1/auth/user": {
    get: { responses: { 200: { content: { "application/json": { user: Record<string, unknown> } } } } }
  }
  "/api/v1/auth/tokens": {
    get: { responses: { 200: { content: { "application/json": { tokens: unknown[] } } } } }
    post: {
      requestBody?: { content: { "application/json": { name: string; abilities?: string[] } } }
      responses: { 201: { content: { "application/json": { token: string } } } }
    }
  }
  "/api/v1/domains": {
    get: { responses: { 200: { content: { "application/json": { domains: unknown[] } } } } }
    post: {
      requestBody?: { content: { "application/json": { domain: string; slug?: string } } }
      responses: { 201: { content: { "application/json": { domain: unknown } } } }
    }
  }
  "/api/v1/databases": {
    get: { responses: { 200: { content: { "application/json": { databases: unknown[] } } } } }
    post: {
      requestBody?: { content: { "application/json": { name: string; engine?: string } } }
      responses: { 201: { content: { "application/json": { database: unknown } } } }
    }
  }
  "/api/v1/webhooks": {
    get: { responses: { 200: { content: { "application/json": { endpoints: unknown[] } } } } }
    post: {
      requestBody?: { content: { "application/json": { name: string; url: string; events: string[] } } }
      responses: { 201: { content: { "application/json": { endpoint: unknown } } } }
    }
  }
  "/api/v1/monitoring/services": {
    get: { responses: { 200: { content: { "application/json": { services: unknown[] } } } } }
  }
  "/api/v1/apps": {
    get: { responses: { 200: { content: { "application/json": { apps: unknown[] } } } } }
  }
  "/api/v1/setup/status": {
    get: { responses: { 200: { content: { "application/json": { data: { needs_setup: boolean } } } } } }
  }
}
