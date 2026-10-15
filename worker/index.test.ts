import { describe, expect, it } from 'vitest';
import app from './index';

describe('API', () => {
  it('reports healthy on GET /api/health', async () => {
    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/nope');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
