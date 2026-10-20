import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const normalize = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, ' ').trim() || 'unknown';

function send(res, status, body) {
  return res.status(status).json(body);
}

async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS public.dc_workspaces (
    workspace_id UUID PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{"transactions":[],"rules":[]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dc_workspaces_updated_at_idx ON public.dc_workspaces (updated_at)`;

  await sql`CREATE TABLE IF NOT EXISTS public.dc_counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, normalized_name)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS public.dc_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'mixed' CHECK (kind IN ('income','expense','mixed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS public.dc_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    transaction_key TEXT NOT NULL,
    transaction_date TEXT,
    amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
    currency TEXT,
    direction TEXT,
    counterparty_id UUID REFERENCES public.dc_counterparties(id) ON DELETE SET NULL,
    counterparty_name TEXT,
    description TEXT,
    reference TEXT,
    category_id UUID REFERENCES public.dc_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    status TEXT,
    confidence TEXT,
    source TEXT,
    fingerprint TEXT,
    original_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, transaction_key)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dc_transactions_date_idx ON public.dc_transactions (workspace_id, transaction_date)`;
  await sql`CREATE INDEX IF NOT EXISTS dc_transactions_category_idx ON public.dc_transactions (workspace_id, category_name)`;
  await sql`CREATE INDEX IF NOT EXISTS dc_transactions_counterparty_idx ON public.dc_transactions (workspace_id, counterparty_id)`;

  await sql`CREATE TABLE IF NOT EXISTS public.dc_classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL,
    counterparty_name TEXT,
    category_name TEXT,
    role TEXT,
    rule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, rule_key)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS public.dc_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    imported_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS public.dc_transaction_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.dc_transactions(id) ON DELETE CASCADE,
    match_type TEXT NOT NULL,
    matched_record_type TEXT NOT NULL,
    matched_record_id TEXT,
    confidence NUMERIC(5,4),
    status TEXT NOT NULL DEFAULT 'suggested',
    match_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS public.dc_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_key TEXT,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function syncNormalizedData(sql, workspaceId, payload) {
  const transactions = payload.transactions || [];
  const rules = payload.rules || [];
  const counterpartyMap = new Map();
  const categoryMap = new Map();

  for (const tx of transactions) {
    const name = String(tx.counterparty || 'Unknown counterparty').trim() || 'Unknown counterparty';
    const key = normalize(name);
    const role = String(tx.role || 'unknown');
    const current = counterpartyMap.get(key) || { name, roles: new Set() };
    if (role) current.roles.add(role);
    counterpartyMap.set(key, current);
    const category = String(tx.category || '').trim();
    if (category) {
      const kind = Number(tx.amount) > 0 ? 'income' : Number(tx.amount) < 0 ? 'expense' : 'mixed';
      const old = categoryMap.get(category);
      categoryMap.set(category, old && old !== kind ? 'mixed' : kind);
    }
  }
  for (const rule of rules) {
    const name = String(rule.counterparty || '').trim();
    if (name) {
      const key = normalize(name);
      if (!counterpartyMap.has(key)) counterpartyMap.set(key, { name, roles: new Set([String(rule.role || 'unknown')]) });
    }
    if (rule.category) categoryMap.set(String(rule.category), categoryMap.get(String(rule.category)) || 'mixed');
  }

  const counterparties = new Map();
  for (const [key, item] of counterpartyMap) {
    const rows = await sql`INSERT INTO public.dc_counterparties
      (workspace_id, normalized_name, display_name, roles)
      VALUES (${workspaceId}::uuid, ${key}, ${item.name}, ${[...item.roles]})
      ON CONFLICT (workspace_id, normalized_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        roles = (SELECT ARRAY(SELECT DISTINCT unnest(public.dc_counterparties.roles || EXCLUDED.roles))),
        updated_at = NOW()
      RETURNING id`;
    counterparties.set(key, rows[0].id);
  }

  const categories = new Map();
  for (const [name, kind] of categoryMap) {
    const rows = await sql`INSERT INTO public.dc_categories (workspace_id, name, kind)
      VALUES (${workspaceId}::uuid, ${name}, ${kind})
      ON CONFLICT (workspace_id, name) DO UPDATE SET
        kind = CASE WHEN public.dc_categories.kind = EXCLUDED.kind THEN public.dc_categories.kind ELSE 'mixed' END,
        updated_at = NOW()
      RETURNING id`;
    categories.set(name, rows[0].id);
  }

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i] || {};
    const key = String(tx.id || tx.fingerprint || `legacy-${i}`);
    const cpKey = normalize(tx.counterparty || 'Unknown counterparty');
    const categoryName = String(tx.category || '').trim();
    const originalData = JSON.stringify(Array.isArray(tx.original) ? tx.original : []);
    const sourceData = JSON.stringify(tx);
    const amount = Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0;
    await sql`INSERT INTO public.dc_transactions (
      workspace_id, transaction_key, transaction_date, amount, currency, direction,
      counterparty_id, counterparty_name, description, reference, category_id, category_name,
      status, confidence, source, fingerprint, original_data, source_data
    ) VALUES (
      ${workspaceId}::uuid, ${key}, ${tx.date || null}, ${amount}, ${tx.currency || null}, ${tx.direction || null},
      ${counterparties.get(cpKey) || null}::uuid, ${tx.counterparty || null}, ${tx.description || null}, ${tx.reference || null},
      ${categories.get(categoryName) || null}::uuid, ${categoryName || null}, ${tx.status || null}, ${tx.confidence || null},
      ${tx.source || null}, ${tx.fingerprint || null}, ${originalData}::jsonb, ${sourceData}::jsonb
    ) ON CONFLICT (workspace_id, transaction_key) DO UPDATE SET
      transaction_date = EXCLUDED.transaction_date, amount = EXCLUDED.amount, currency = EXCLUDED.currency,
      direction = EXCLUDED.direction, counterparty_id = EXCLUDED.counterparty_id,
      counterparty_name = EXCLUDED.counterparty_name, description = EXCLUDED.description,
      reference = EXCLUDED.reference, category_id = EXCLUDED.category_id, category_name = EXCLUDED.category_name,
      status = EXCLUDED.status, confidence = EXCLUDED.confidence, source = EXCLUDED.source,
      fingerprint = EXCLUDED.fingerprint, original_data = EXCLUDED.original_data,
      source_data = EXCLUDED.source_data, updated_at = NOW()`;
  }

  for (const rule of rules) {
    const key = String(rule.key || normalize(rule.counterparty || 'unknown'));
    await sql`INSERT INTO public.dc_classification_rules
      (workspace_id, rule_key, counterparty_name, category_name, role, rule_data)
      VALUES (${workspaceId}::uuid, ${key}, ${rule.counterparty || null}, ${rule.category || null}, ${rule.role || null}, ${JSON.stringify(rule)}::jsonb)
      ON CONFLICT (workspace_id, rule_key) DO UPDATE SET
        counterparty_name = EXCLUDED.counterparty_name, category_name = EXCLUDED.category_name,
        role = EXCLUDED.role, rule_data = EXCLUDED.rule_data, updated_at = NOW()`;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!process.env.DATABASE_URL) {
    return send(res, 503, { error: 'Database connection is not configured', code: 'DATABASE_NOT_CONFIGURED' });
  }

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
    await ensureSchema(sql);
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
      FROM public.dc_workspaces WHERE workspace_id = ${workspaceId}::uuid LIMIT 1`;
    const workspace = rows[0];
    if (!workspace || workspace.token_hash !== hashToken(token)) {
      return send(res, 401, { error: 'Workspace credential was not accepted', code: 'INVALID_CREDENTIALS' });
    }

    const currentPayload = workspace.payload || { transactions: [], rules: [] };
    if (req.method === 'GET') {
      // Backfill normalized tables from existing prototype payloads before returning them.
      await syncNormalizedData(sql, workspaceId, currentPayload);
      return send(res, 200, { payload: currentPayload });
    }

    if (req.body?.action !== 'save') return send(res, 400, { error: 'Unsupported action' });
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

    await syncNormalizedData(sql, workspaceId, payload);
    await sql`UPDATE public.dc_workspaces
      SET payload = ${serialized}::jsonb, updated_at = NOW()
      WHERE workspace_id = ${workspaceId}::uuid`;
    return send(res, 200, { ok: true, updatedAt: new Date().toISOString(), normalized: true });
  } catch (error) {
    console.error('Data Center request failed:', error);
    return send(res, 500, { error: 'Could not access Data Center storage' });
  }
}
