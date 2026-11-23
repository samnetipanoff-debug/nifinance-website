-- NIFINANCE Accounting Core foundation
-- Additive migration: does not alter or delete Data Center / CRM / Universe tables.
-- Apply through the project's Neon migration process.

BEGIN;

CREATE TABLE IF NOT EXISTS acc_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  code text,
  base_currency char(3),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS acc_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  code text NOT NULL,
  legal_name text NOT NULL,
  country_code char(2),
  tax_identifier text,
  functional_currency char(3) NOT NULL,
  presentation_currency char(3),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS acc_entity_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  parent_entity_id uuid NOT NULL,
  child_entity_id uuid NOT NULL,
  relationship_type text NOT NULL DEFAULT 'subsidiary',
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  CHECK (parent_entity_id <> child_entity_id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  FOREIGN KEY (parent_entity_id, organization_id) REFERENCES acc_entities(id, organization_id),
  FOREIGN KEY (child_entity_id, organization_id) REFERENCES acc_entities(id, organization_id),
  UNIQUE (organization_id, parent_entity_id, child_entity_id, valid_from)
);

CREATE TABLE IF NOT EXISTS acc_accounting_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid,
  name text NOT NULL,
  framework text NOT NULL CHECK (framework IN ('management','rsbu','ifrs','us_gaap')),
  jurisdiction_code char(2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_id, organization_id) REFERENCES acc_entities(id, organization_id),
  UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS acc_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES acc_accounting_policies(id),
  version integer NOT NULL CHECK (version > 0),
  effective_from date NOT NULL,
  effective_to date,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (policy_id, version)
);

CREATE TABLE IF NOT EXISTS acc_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  book_type text NOT NULL CHECK (book_type IN ('management','rsbu','ifrs')),
  name text NOT NULL,
  functional_currency char(3) NOT NULL,
  presentation_currency char(3),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_id, organization_id) REFERENCES acc_entities(id, organization_id),
  FOREIGN KEY (policy_id, organization_id) REFERENCES acc_accounting_policies(id, organization_id),
  UNIQUE (id, entity_id, organization_id),
  UNIQUE (entity_id, book_type, name)
);

CREATE TABLE IF NOT EXISTS acc_chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES acc_books(id),
  name text NOT NULL,
  version text NOT NULL DEFAULT '1',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (book_id, name, version),
  UNIQUE (id, book_id)
);

CREATE TABLE IF NOT EXISTS acc_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id uuid NOT NULL,
  book_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  account_class text NOT NULL CHECK (account_class IN ('asset','liability','equity','revenue','expense','off_balance')),
  normal_side text NOT NULL CHECK (normal_side IN ('debit','credit')),
  parent_account_id uuid REFERENCES acc_accounts(id),
  allows_posting boolean NOT NULL DEFAULT true,
  is_control_account boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (chart_id, book_id) REFERENCES acc_chart_of_accounts(id, book_id),
  UNIQUE (book_id, code),
  UNIQUE (id, book_id)
);

CREATE TABLE IF NOT EXISTS acc_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES acc_entities(id),
  period_code text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','soft_closed','closed')),
  closed_at timestamptz,
  closed_by text,
  CHECK (ends_on >= starts_on),
  UNIQUE (entity_id, period_code),
  UNIQUE (id, entity_id)
);

CREATE TABLE IF NOT EXISTS acc_business_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  event_date date NOT NULL,
  description text NOT NULL,
  counterparty_ref text,
  contract_ref text,
  source_system text,
  source_table text,
  source_record_id text,
  idempotency_key text,
  original_currency char(3),
  original_amount numeric(24,8),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','accounted','cancelled')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_id, organization_id) REFERENCES acc_entities(id, organization_id),
  UNIQUE (organization_id, source_system, source_table, source_record_id),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (id, entity_id, organization_id)
);

CREATE TABLE IF NOT EXISTS acc_transaction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES acc_business_transactions(id),
  document_type text NOT NULL,
  document_number text,
  document_date date,
  file_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acc_posting_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES acc_business_transactions(id),
  book_id uuid NOT NULL REFERENCES acc_books(id),
  policy_version_id uuid REFERENCES acc_policy_versions(id),
  proposal_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','posted','superseded')),
  explanation text,
  proposed_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, book_id, proposal_version),
  UNIQUE (id, book_id)
);

CREATE TABLE IF NOT EXISTS acc_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid NOT NULL,
  book_id uuid NOT NULL,
  period_id uuid NOT NULL,
  transaction_id uuid REFERENCES acc_business_transactions(id),
  proposal_id uuid REFERENCES acc_posting_proposals(id),
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  posting_date date NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','proposed','approved','posted','rejected')),
  source_type text,
  source_id text,
  policy_version_id uuid REFERENCES acc_policy_versions(id),
  created_by text,
  approved_by text,
  approved_at timestamptz,
  posted_by text,
  posted_at timestamptz,
  reverses_entry_id uuid REFERENCES acc_journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (book_id, entity_id, organization_id) REFERENCES acc_books(id, entity_id, organization_id),
  FOREIGN KEY (period_id, entity_id) REFERENCES acc_periods(id, entity_id),
  UNIQUE (book_id, entry_number),
  UNIQUE (id, book_id)
);

CREATE TABLE IF NOT EXISTS acc_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL,
  book_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  account_id uuid NOT NULL,
  description text,
  debit numeric(24,8) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(24,8) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  transaction_currency char(3),
  transaction_amount numeric(24,8),
  exchange_rate numeric(24,12),
  counterparty_ref text,
  contract_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  FOREIGN KEY (journal_entry_id, book_id) REFERENCES acc_journal_entries(id, book_id),
  FOREIGN KEY (account_id, book_id) REFERENCES acc_accounts(id, book_id),
  UNIQUE (journal_entry_id, line_number)
);

CREATE TABLE IF NOT EXISTS acc_posting_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES acc_journal_entries(id),
  action text NOT NULL CHECK (action IN ('submitted','approved','rejected','returned')),
  actor_id text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acc_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  value_type text NOT NULL DEFAULT 'reference',
  is_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  UNIQUE (organization_id, code),
  UNIQUE (id, organization_id)
);

CREATE TABLE IF NOT EXISTS acc_dimension_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES acc_dimensions(id),
  code text NOT NULL,
  name text NOT NULL,
  parent_value_id uuid REFERENCES acc_dimension_values(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  UNIQUE (dimension_id, code),
  UNIQUE (id, dimension_id)
);

CREATE TABLE IF NOT EXISTS acc_line_dimensions (
  journal_line_id uuid NOT NULL REFERENCES acc_journal_lines(id),
  dimension_id uuid NOT NULL,
  dimension_value_id uuid NOT NULL,
  PRIMARY KEY (journal_line_id, dimension_id),
  FOREIGN KEY (dimension_value_id, dimension_id) REFERENCES acc_dimension_values(id, dimension_id)
);

CREATE TABLE IF NOT EXISTS acc_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  from_currency char(3) NOT NULL,
  to_currency char(3) NOT NULL,
  rate_date date NOT NULL,
  rate_type text NOT NULL,
  rate numeric(24,12) NOT NULL CHECK (rate > 0),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, from_currency, to_currency, rate_date, rate_type)
);

CREATE TABLE IF NOT EXISTS acc_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid NOT NULL,
  reconciliation_type text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','partially_matched','closed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entity_id, organization_id) REFERENCES acc_entities(id, organization_id)
);

CREATE TABLE IF NOT EXISTS acc_reconciliation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES acc_reconciliations(id),
  transaction_id uuid REFERENCES acc_business_transactions(id),
  journal_line_id uuid REFERENCES acc_journal_lines(id),
  matched_amount numeric(24,8) NOT NULL CHECK (matched_amount > 0),
  CHECK (transaction_id IS NOT NULL OR journal_line_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS acc_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id uuid NOT NULL REFERENCES acc_accounts(id),
  target_account_id uuid NOT NULL REFERENCES acc_accounts(id),
  mapping_type text NOT NULL DEFAULT 'one_to_one',
  effective_from date NOT NULL,
  effective_to date,
  CHECK (source_account_id <> target_account_id OR mapping_type = 'same_account'),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE IF NOT EXISTS acc_reporting_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code IN ('management','rsbu','ifrs')),
  name text NOT NULL,
  jurisdiction_code char(2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);

CREATE TABLE IF NOT EXISTS acc_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES acc_reporting_frameworks(id),
  report_code text NOT NULL,
  name text NOT NULL,
  version text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (framework_id, report_code, version)
);

CREATE TABLE IF NOT EXISTS acc_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES acc_organizations(id),
  entity_id uuid REFERENCES acc_entities(id),
  framework_id uuid NOT NULL REFERENCES acc_reporting_frameworks(id),
  template_id uuid NOT NULL REFERENCES acc_report_templates(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  presentation_currency char(3),
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','reviewed','approved','superseded')),
  result jsonb NOT NULL,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_acc_entities_org ON acc_entities(organization_id);
CREATE INDEX IF NOT EXISTS idx_acc_books_entity ON acc_books(entity_id, book_type);
CREATE INDEX IF NOT EXISTS idx_acc_accounts_book ON acc_accounts(book_id, code);
CREATE INDEX IF NOT EXISTS idx_acc_periods_entity_dates ON acc_periods(entity_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_acc_transactions_entity_date ON acc_business_transactions(entity_id, event_date);
CREATE INDEX IF NOT EXISTS idx_acc_transactions_source ON acc_business_transactions(source_system, source_table, source_record_id);
CREATE INDEX IF NOT EXISTS idx_acc_proposals_status ON acc_posting_proposals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_acc_entries_book_date ON acc_journal_entries(book_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_acc_entries_transaction ON acc_journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_acc_lines_account ON acc_journal_lines(account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_acc_approvals_entry ON acc_posting_approvals(journal_entry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_acc_reconciliation_transaction ON acc_reconciliation_lines(transaction_id);

-- Posted journal entries and their lines are immutable. Corrections use a reversal entry.
CREATE OR REPLACE FUNCTION acc_guard_posted_entry_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'acc_journal_entries' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Posted journal entries are immutable; create a reversal entry';
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM acc_journal_entries
    WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id)
      AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'Lines of posted journal entries are immutable; create a reversal entry';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_acc_journal_entry_immutable ON acc_journal_entries;
CREATE TRIGGER trg_acc_journal_entry_immutable
BEFORE UPDATE OR DELETE ON acc_journal_entries
FOR EACH ROW EXECUTE FUNCTION acc_guard_posted_entry_mutation();

DROP TRIGGER IF EXISTS trg_acc_journal_line_immutable ON acc_journal_lines;
CREATE TRIGGER trg_acc_journal_line_immutable
BEFORE UPDATE OR DELETE ON acc_journal_lines
FOR EACH ROW EXECUTE FUNCTION acc_guard_posted_entry_mutation();

-- The posting operation is atomic and validates approval, period and double-entry balance.
CREATE OR REPLACE FUNCTION acc_post_journal_entry(
  p_entry_id uuid,
  p_actor_id text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry acc_journal_entries%ROWTYPE;
  v_line_count integer;
  v_debit numeric(24,8);
  v_credit numeric(24,8);
  v_period_status text;
BEGIN
  SELECT * INTO v_entry
  FROM acc_journal_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF v_entry.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved journal entries can be posted';
  END IF;

  SELECT status INTO v_period_status
  FROM acc_periods
  WHERE id = v_entry.period_id AND entity_id = v_entry.entity_id
  FOR UPDATE;

  IF v_period_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Accounting period is not open';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO v_line_count, v_debit, v_credit
  FROM acc_journal_lines
  WHERE journal_entry_id = p_entry_id;

  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'A journal entry must contain at least two lines';
  END IF;
  IF abs(v_debit - v_credit) > 0.000001 THEN
    RAISE EXCEPTION 'Journal entry is not balanced: debit %, credit %', v_debit, v_credit;
  END IF;

  UPDATE acc_journal_entries
  SET status = 'posted', posted_by = p_actor_id, posted_at = now()
  WHERE id = p_entry_id;

  INSERT INTO acc_posting_approvals(journal_entry_id, action, actor_id, comment)
  VALUES (p_entry_id, 'submitted', p_actor_id, 'Posted to ledger');

  RETURN p_entry_id;
END;
$$;

INSERT INTO acc_reporting_frameworks(code, name)
VALUES
  ('management','Management Accounting'),
  ('rsbu','Russian Accounting Standards'),
  ('ifrs','International Financial Reporting Standards')
ON CONFLICT (code) DO NOTHING;

COMMIT;
