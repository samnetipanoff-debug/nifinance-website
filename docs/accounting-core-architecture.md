# NIFINANCE Accounting Core

## Decisions

- One business-event registry shared by accounting books.
- Parallel posting books: management, RAS (РСБУ), IFRS, and US GAAP (МСФО).
- Hybrid management accounting: a dedicated management book plus extensible analytical dimensions.
- Multi-entity support from the foundation.
- Human approval before posting.
- Neon/PostgreSQL remains the system of record.
- Data Center remains the source/import and operational matching layer.
- Universe remains a consumer/visualization layer; it is not a ledger.

## Data flow

`dc_transactions` / source documents / CRM facts
-> `acc_business_transactions`
-> book-specific `acc_posting_proposals`
-> approved `acc_journal_entries` + `acc_journal_lines`
-> posted ledger
-> trial balance and reporting.

A bank movement is not automatically revenue or expense. Accrual events and settlement events are separate business events and can be reconciled, including partial settlements.

## Initial schema

The additive SQL foundation is split into ordered migrations:

1. `database/accounting_core_foundation.sql`
   - organizations and legal entities;
   - accounting policies, versions, books and charts of accounts;
   - accounts and accounting periods;
   - business transactions and source documents;
   - posting proposals, journal entries and journal lines;
   - approval history and analytical dimensions;
   - exchange rates, reconciliation, account mappings and versioned report templates.
2. `database/accounting_core_foundation_hardening.sql`
   - hardens immutable posted-entry and posted-line behavior;
   - adds a posting audit action.
3. `database/accounting_core_posting_guard.sql`
   - restricts transition to `posted` to the validated database posting function.

Apply in this order, in a controlled Neon migration session. These migrations are additive and do not alter or delete Data Center, CRM, or Universe tables.

## Posting invariants

- A journal entry belongs to one organization, legal entity, book and period.
- Accounts used by a line must belong to the same book as the entry.
- Every line has exactly one positive side: debit or credit.
- A posted entry has at least two lines and total debit equals total credit in the book's functional currency.
- Only approved entries in open periods may be posted.
- Posted entries and their lines are immutable; corrections use reversal entries.
- Source references and idempotency keys prevent duplicate ingestion.
- A proposal is not a ledger posting. A bank transaction is not itself an accounting entry.

## Important implementation boundary

This is the database foundation, not a claim of complete RAS/IFRS/US GAAP compliance. The initial schema does not yet implement standard-specific recognition/measurement rules, depreciation, tax, provisions, FX revaluation, period close, consolidation eliminations, or statutory report calculations. Those are subsequent accounting-engine and reporting milestones and require versioned policies and validated domain rules.

## Next implementation slices

1. Add authenticated organization/entity/book APIs with strict tenant scoping.
2. Add chart-of-accounts management and seed configurable starter charts (never hard-code one universal chart for every framework/jurisdiction).
3. Add transaction intake from Data Center with idempotent source references.
4. Add proposal generation and approval UI.
5. Implement posting through `acc_post_journal_entry` only.
6. Add ledger queries and trial balance.
7. Reconcile accruals and cash settlements.
8. Add management reports, then RAS, IFRS and US GAAP policy/report packs.
9. Add period close, FX revaluation and multi-entity consolidation.

## Deployment safety

Do not apply the SQL to production Neon until the migration order, database role permissions, and backup/rollback approach are confirmed. Do not merge this branch directly to production before the migration has been exercised against a disposable Neon branch/database and the posting invariants have been tested.
