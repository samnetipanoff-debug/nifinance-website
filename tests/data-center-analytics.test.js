import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../api/data-center-analytics.js';

test('keeps cash and accrual views separate and excludes financing from operating totals', () => {
  const result = summarize([
    { date: '2026-01-02', amount: 1000, currency: 'EUR', basis: 'cash', category: 'Sales income', counterparty: 'Customer A' },
    { date: '2026-01-03', amount: -300, currency: 'EUR', basis: 'cash', category: 'Software & subscriptions', counterparty: 'Software Co' },
    { date: '2026-01-04', amount: 5000, currency: 'EUR', basis: 'cash', category: 'Loan proceeds', description: 'Loan received', counterparty: 'Bank' },
    { date: '2026-01-05', amount: -200, currency: 'EUR', basis: 'cash', category: 'Loan principal', description: 'Principal repayment', counterparty: 'Bank' },
    { date: '2026-01-06', amount: -50, currency: 'EUR', basis: 'cash', category: 'Interest expense', counterparty: 'Bank' },
    { date: '2026-01-07', amount: -400, currency: 'EUR', basis: 'cash', category: 'Internal transfer', description: 'Transfer between own accounts' },
    { date: '2026-01-08', amount: 400, currency: 'EUR', basis: 'cash', category: 'Internal transfer', description: 'Transfer between own accounts' },
    { date: '2026-01-09', amount: 1200, currency: 'EUR', basis: 'accrual', category: 'Sales income', counterparty: 'Customer A' },
    { date: '2026-01-10', amount: -700, currency: 'EUR', basis: 'accrual', category: 'Contractors & external services', counterparty: 'Contractor B' },
    { date: '2026-01-11', amount: 999, currency: 'EUR', category: 'Sales income', counterparty: 'Unknown basis' }
  ]);

  assert.equal(result.cash.inflows, 1000);
  assert.equal(result.cash.outflows, 350);
  assert.equal(result.cash.netCashMovement, 650);
  assert.equal(result.cash.financing.loanProceeds, 5000);
  assert.equal(result.cash.financing.principalRepayments, 200);
  assert.equal(result.accrual.inflows, 1200);
  assert.equal(result.accrual.outflows, 700);
  assert.equal(result.managementPnl.status, 'provisional');
  assert.equal(result.dataScope.unconfirmedBasisCount, 1);
  assert.equal(result.dataScope.cashCount, 7);
  assert.equal(result.dataScope.accrualCount, 2);
});

test('does not claim an accrual P&L when only cash records exist', () => {
  const result = summarize([
    { date: '2026-02-01', amount: 100, basis: 'cash', category: 'Sales income', currency: 'EUR' }
  ]);
  assert.equal(result.managementPnl.status, 'unavailable');
  assert.equal(result.accrual.transactionCount, 0);
});

test('flags multiple currencies instead of silently converting or summing them', () => {
  const result = summarize([
    { date: '2026-03-01', amount: 100, basis: 'cash', category: 'Sales income', currency: 'EUR' },
    { date: '2026-03-02', amount: 100, basis: 'cash', category: 'Sales income', currency: 'USD' }
  ]);
  assert.ok(result.alerts.some((alert) => alert.code === 'MULTIPLE_CURRENCIES'));
});
