import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

function send(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!process.env.DATABASE_URL) {
    return send(res, 503, {
      error: 'Database connection is not configured',
      code: 'DATABASE_NOT_CONFIGURED'
    });
  }

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS public.dc_workspaces (
      workspace_id UUID PRIMARY KEY,
      token_hash CHAR(64) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{"transactions":[],"rules":[]}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS dc_workspaces_updated_at_idx ON public.dc_workspaces (updated_at)`;
  } catch (error) {
    console.error('Data Center database initialization failed:', error);
    return send(res, 500, { error: 'Could not initialize Data Center storage' });
  }

  if (req.method === 'POST' && req.body?.action === 'create') {
    try {
      const workspaceId = randomUUID();
      const token = randomBytes(32).toString('base64url');
      await sql`INSERT INTO public.dc_workspaces (workspace_id, token_hash, payload)
        VALUES (${workspaceId}::uuid, ${hashToken(token)}, '{"transactions":[],"rules":[]}'::jsonb)`;
      return send(res, 201, { workspaceId, token, payload: { transactions: [], rules: [] } });
    } catch (error) {
      console.error('Data Center workspace creation failed:', error);
      return send(res, 500, { error: 'Could not create Data Center workspace' });
    }
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const workspaceId = req.headers['x-workspace-id'];
  const token = req.headers['x-workspace-token'];
  if (!isUuid(workspaceId) || typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return send(res, 401, { error: 'A valid workspace credential is required', code: 'INVALID_CREDENTIALS' });
  }

  try {
    const rows = await sql`SELECT workspace_id, token_hash, payload
      FROM public.dc_workspaces
      WHERE workspace_id = ${workspaceId}::uuid
      LIMIT 1`;
    const workspace = rows[0];
    if (!workspace || workspace.token_hash !== hashToken(token)) {
      return send(res, 401, { error: 'Workspace credential was not accepted', code: 'INVALID_CREDENTIALS' });
    }

    if (req.method === 'GET') {
      return send(res, 200, { payload: workspace.payload || { transactions: [], rules: [] } });
    }

    if (req.body?.action !== 'save') {
      return send(res, 400, { error: 'Unsupported action' });
    }

    const payload = req.body.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return send(res, 400, { error: 'Payload must be an object' });
    }
    if (!Array.isArray(payload.transactions) || !Array.isArray(payload.rules)) {
      return send(res, 400, { error: 'Payload must contain transactions and rules arrays' });
    }
    const serialized = JSON.stringify({ transactions: payload.transactions, rules: payload.rules });
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
      return send(res, 413, { error: 'Workspace data exceeds the 5 MB prototype limit' });
    }

    await sql`UPDATE public.dc_workspaces
      SET payload = ${serialized}::jsonb, updated_at = NOW()
      WHERE workspace_id = ${workspaceId}::uuid`;
    return send(res, 200, { ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Data Center request failed:', error);
    return send(res, 500, { error: 'Could not access Data Center storage' });
  }
}
