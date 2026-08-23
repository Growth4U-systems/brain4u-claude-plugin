const DEFAULT_ENDPOINT = 'https://api.hetzner.cloud/v1';

function sanitizeApiError(body, status) {
  const code = body?.error?.code || 'http_error';
  const message = body?.error?.message || `Hetzner API returned HTTP ${status}`;
  return new Error(`Hetzner API ${code}: ${message}`);
}

export class HetznerClient {
  constructor({ token, fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT }) {
    if (!token) throw new Error('Hetzner API token is unavailable');
    if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  async request(method, resource, { query, body } = {}) {
    const url = new URL(`${this.endpoint}${resource}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`Hetzner API request failed: ${String(error?.message ?? error).replaceAll(this.token, '[REDACTED]')}`);
    }

    const text = await response.text();
    let parsed = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (!response.ok) throw new Error(`Hetzner API returned HTTP ${response.status}`);
        throw new Error('Hetzner API returned invalid JSON');
      }
    }
    if (!response.ok) throw sanitizeApiError(parsed, response.status);
    return parsed;
  }

  get(resource, query) {
    return this.request('GET', resource, { query });
  }

  post(resource, body) {
    return this.request('POST', resource, { body });
  }

  async listAll(resource, collection, query = {}) {
    const items = [];
    for (let page = 1; ; page += 1) {
      const response = await this.get(resource, { ...query, page, per_page: 50 });
      items.push(...(response[collection] ?? []));
      const nextPage = response.meta?.pagination?.next_page;
      if (!nextPage) return items;
      page = nextPage - 1;
    }
  }

  async waitForAction(actionId, { timeoutMs = 120_000, intervalMs = 1_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { action } = await this.get(`/actions/${actionId}`);
      if (action?.status === 'success') return action;
      if (action?.status === 'error') {
        const detail = action.error?.message || action.error?.code || 'unknown action error';
        throw new Error(`Hetzner action ${actionId} failed: ${detail}`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Hetzner action ${actionId} did not finish within ${timeoutMs}ms`);
  }
}
