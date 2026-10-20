-- NIFINANCE Data Center relational schema
-- Safe to run repeatedly. Does not alter demo/Universe tables or delete dc_workspaces.payload.
-- The API also creates these tables automatically; this file is provided for review/manual application.

CREATE TABLE IF NOT EXISTS public.dc_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.dc_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'mixed' CHECK (kind IN ('income','expense','mixed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.dc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
  transaction_key TEXT NOT NULL,
  transaction_date TEXT,
  amount NUMERIC(20,4) NOT NULL DEFAULT 0,
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
);
CREATE INDEX IF NOT EXISTS dc_transactions_date_idx ON public.dc_transactions (workspace_id, transaction_date);
CREATE INDEX IF NOT EXISTS dc_transactions_category_idx ON public.dc_transactions (workspace_id, category_name);
CREATE INDEX IF NOT EXISTS dc_transactions_counterparty_idx ON public.dc_transactions (workspace_id, counterparty_id);

CREATE TABLE IF NOT EXISTS public.dc_classification_rules (
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
);

CREATE TABLE IF NOT EXISTS public.dc_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dc_transaction_matches (
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
);

CREATE TABLE IF NOT EXISTS public.dc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_key TEXT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
