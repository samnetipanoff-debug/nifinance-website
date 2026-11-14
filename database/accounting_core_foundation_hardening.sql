-- NIFINANCE Accounting Core foundation hardening
-- Apply after accounting_core_foundation.sql.

BEGIN;

ALTER TABLE acc_posting_approvals
  DROP CONSTRAINT IF EXISTS acc_posting_approvals_action_check;
ALTER TABLE acc_posting_approvals
  ADD CONSTRAINT acc_posting_approvals_action_check
  CHECK (action IN ('submitted','approved','rejected','returned','posted'));

CREATE OR REPLACE FUNCTION acc_guard_posted_entry_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_entry_id uuid;
  v_status text;
BEGIN
  IF TG_TABLE_NAME = 'acc_journal_entries' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'posted' THEN
        RAISE EXCEPTION 'Journal entries must pass approval and posting validation';
      END IF;
      RETURN NEW;
    END IF;

    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Posted journal entries are immutable; create a reversal entry';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    IF NEW.status = 'posted' AND OLD.status <> 'approved' THEN
      RAISE EXCEPTION 'Only approved journal entries can be posted';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD.journal_entry_id;
  ELSE
    v_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT status INTO v_status
  FROM acc_journal_entries
  WHERE id = v_entry_id;

  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Lines of posted journal entries are immutable; create a reversal entry';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acc_journal_entry_immutable ON acc_journal_entries;
CREATE TRIGGER trg_acc_journal_entry_immutable
BEFORE INSERT OR UPDATE OR DELETE ON acc_journal_entries
FOR EACH ROW EXECUTE FUNCTION acc_guard_posted_entry_mutation();

DROP TRIGGER IF EXISTS trg_acc_journal_line_immutable ON acc_journal_lines;
CREATE TRIGGER trg_acc_journal_line_immutable
BEFORE INSERT OR UPDATE OR DELETE ON acc_journal_lines
FOR EACH ROW EXECUTE FUNCTION acc_guard_posted_entry_mutation();

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
  VALUES (p_entry_id, 'posted', p_actor_id, 'Posted to ledger');

  RETURN p_entry_id;
END;
$$;

COMMIT;
