import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../database/accounting_core_foundation.sql', import.meta.url), 'utf8');

test('Accounting Core defines four independent ledgers/frameworks', () => {
  for (const framework of ['management', 'rsbu', 'ifrs', 'us_gaap']) {
    assert.match(schema, new RegExp("'" + framework + "'"));
  }
  assert.match(schema, /framework text NOT NULL CHECK/);
  assert.match(schema, /book_type text NOT NULL CHECK/);
  assert.match(schema, /code text NOT NULL UNIQUE CHECK/);
});

test('Accounting Core keeps source events separate from posted journal entries', () => {
  for (const table of [
    'acc_business_transactions',
    'acc_posting_proposals',
    'acc_journal_entries',
    'acc_journal_lines',
    'acc_posting_approvals',
    'acc_reconciliations'
  ]) {
    assert.match(schema, new RegExp('CREATE TABLE IF NOT EXISTS ' + table));
  }
  assert.match(schema, /UNIQUE \(organization_id, source_system, source_table, source_record_id\)/);
  assert.match(schema, /CHECK \(\(debit > 0 AND credit = 0\) OR \(credit > 0 AND debit = 0\)\)/);
});

test('Accounting Core migration remains additive and transaction-wrapped', () => {
  assert.match(schema, /^BEGIN;/);
  assert.match(schema.trim(), /COMMIT;$/);
  assert.match(schema, /does not alter or delete Data Center \/ CRM \/ Universe tables/i);
});
