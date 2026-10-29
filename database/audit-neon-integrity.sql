-- NIFINANCE Neon integrity audit (READ ONLY)
-- Run in the Neon SQL Editor against the production database.
-- This script does not INSERT, UPDATE, DELETE, CREATE, ALTER, or DROP anything.

-- 1) Relevant tables and approximate live row counts.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.reltuples::bigint AS estimated_rows,
  c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND (
    c.relname LIKE 'dc\_%' ESCAPE '\'
    OR c.relname LIKE 'bh\_%' ESCAPE '\'
  )
ORDER BY c.relname;

-- 2) Foreign keys on Data Center, CRM and business-graph tables.
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS validated
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND (
    conrelid::regclass::text LIKE 'public.dc\_%' ESCAPE '\'
    OR conrelid::regclass::text LIKE 'public.bh\_%' ESCAPE '\'
  )
ORDER BY table_name::text, constraint_name;

-- 3) Uniqueness and indexes used to protect identity and prevent duplicates.
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'dc\_%' ESCAPE '\' OR tablename LIKE 'bh\_%' ESCAPE '\')
ORDER BY tablename, indexname;

-- 4) Cross-workspace integrity checks. Each query returns a count; zero is expected.
-- Finance operation -> counterparty/category must belong to the same workspace.
SELECT 'transaction_counterparty_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.dc_transactions t
JOIN public.dc_counterparties p ON p.id = t.counterparty_id
WHERE p.workspace_id <> t.workspace_id;

SELECT 'transaction_category_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.dc_transactions t
JOIN public.dc_categories c ON c.id = t.category_id
WHERE c.workspace_id <> t.workspace_id;

-- CRM deal -> contact must belong to the same workspace.
SELECT 'deal_contact_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.bh_deals d
JOIN public.bh_contacts c ON c.id = d.contact_id
WHERE c.workspace_id <> d.workspace_id;

-- CRM activity -> contact/deal must belong to the same workspace.
SELECT 'activity_contact_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.bh_activities a
JOIN public.bh_contacts c ON c.id = a.contact_id
WHERE c.workspace_id <> a.workspace_id;

SELECT 'activity_deal_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.bh_activities a
JOIN public.bh_deals d ON d.id = a.deal_id
WHERE d.workspace_id <> a.workspace_id;

-- Chat message -> channel must belong to the same workspace.
SELECT 'chat_message_channel_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
FROM public.bh_chat_messages m
JOIN public.bh_chat_channels c ON c.id = m.channel_id
WHERE c.workspace_id <> m.workspace_id;

-- 5) Duplicate natural keys. Zero is expected where unique constraints exist.
SELECT 'duplicate_counterparty_normalized_name' AS check_name, COUNT(*)::bigint AS issue_count
FROM (
  SELECT workspace_id, normalized_name
  FROM public.dc_counterparties
  GROUP BY workspace_id, normalized_name
  HAVING COUNT(*) > 1
) d;

SELECT 'duplicate_category_name' AS check_name, COUNT(*)::bigint AS issue_count
FROM (
  SELECT workspace_id, name
  FROM public.dc_categories
  GROUP BY workspace_id, name
  HAVING COUNT(*) > 1
) d;

SELECT 'duplicate_transaction_key' AS check_name, COUNT(*)::bigint AS issue_count
FROM (
  SELECT workspace_id, transaction_key
  FROM public.dc_transactions
  GROUP BY workspace_id, transaction_key
  HAVING COUNT(*) > 1
) d;

-- 6) Data Center JSON payload vs normalized table row counts.
-- This is a diagnostic only; counts do not prove row-by-row equivalence.
SELECT
  w.workspace_id,
  COALESCE(jsonb_array_length(w.payload->'transactions'), 0) AS payload_transaction_count,
  (
    SELECT COUNT(*)::int
    FROM public.dc_transactions t
    WHERE t.workspace_id = w.workspace_id
  ) AS normalized_transaction_count,
  COALESCE(jsonb_array_length(w.payload->'rules'), 0) AS payload_rule_count,
  (
    SELECT COUNT(*)::int
    FROM public.dc_classification_rules r
    WHERE r.workspace_id = w.workspace_id
  ) AS normalized_rule_count
FROM public.dc_workspaces w
ORDER BY w.created_at DESC;

-- 7) Cross-workspace graph-link integrity (only meaningful if these tables exist).
-- Check the existence of dc_business_objects and dc_business_links in result set #1.
-- If present, run:
-- SELECT 'business_link_workspace_mismatch' AS check_name, COUNT(*)::bigint AS issue_count
-- FROM public.dc_business_links l
-- JOIN public.dc_business_objects s ON s.id = l.source_object_id
-- JOIN public.dc_business_objects t ON t.id = l.target_object_id
-- WHERE s.workspace_id <> l.workspace_id OR t.workspace_id <> l.workspace_id
--    OR s.organization_id <> l.organization_id OR t.organization_id <> l.organization_id;
