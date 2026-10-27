import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const send = (res, status, body) => res.status(status).json(body);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const norm = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, ' ').trim();
const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const amountOf = (tx) => {
  const n = Number(tx?.amount);
  return Number.isFinite(n) ? n : 0;
};
const basisOf = (tx) => {
  const basis = String(tx?.basis || tx?.accountingBasis || tx?.sourceBasis || tx?.sourceType || tx?.source_type || '').toLowerCase();
  if (['cash', 'cash_basis', 'bank_statement', 'bank statement', 'bank'].includes(basis)) return 'cash';
  if (['accrual', 'accrual_basis', 'accounting_journal', 'accounting journal', '1c', '1с'].includes(basis)) return 'accrual';
  return 'unknown';
};
const categoryOf = (tx) => String(tx?.category || tx?.categoryName || 'Needs review').trim() || 'Needs review';
const dateOf = (tx) => {
  const raw = String(tx?.date || tx?.transaction_date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : null;
};
const monthOf = (tx) => dateOf(tx)?.slice(0, 7) || 'Undated';
const currencyOf = (tx) => String(tx?.currency || '').trim().toUpperCase() || 'UNSPECIFIED';
const loanTextOf = (tx) => categoryOf(tx) + ' ' + String(tx?.description || '');
const isLoanProceeds = (tx) => /loan proceeds|loan received|credit received|proceeds from loan|received loan|кредит получен|получен кредит|получение кредита|поступление кредита|получение займа|заем получен|займ получен/i.test(loanTextOf(tx));
const isPrincipalRepayment = (tx) => /loan principal|principal repayment|repayment of principal|тело кредита|погашение основного долга|погашение тела кредита|возврат основного долга/i.test(loanTextOf(tx));
const isTransfer = (tx) => /internal transfer|перевод между счет|внутренний перевод/i.test(categoryOf(tx) + ' ' + String(tx?.description || ''));
const isInterest = (tx) => /interest expense|процент по кредит|проценты по кредит/i.test(categoryOf(tx) + ' ' + String(tx?.description || ''));
const isRefund = (tx) => /refund|reversal|возврат|сторно/i.test(categoryOf(tx) + ' ' + String(tx?.description || ''));

export function summarize(transactions) {
  const rows = transactions.map((tx, index) => ({ ...tx, _index: index, _amount: amountOf(tx), _basis: basisOf(tx), _date: dateOf(tx), _category: categoryOf(tx), _month: monthOf(tx), _currency: currencyOf(tx) }));
  const cashRows = rows.filter((tx) => tx._basis === 'cash');
  const accrualRows = rows.filter((tx) => tx._basis === 'accrual');
  const unknownRows = rows.filter((tx) => tx._basis === 'unknown');
  const reviewRows = rows.filter((tx) => /review|pending|unclassified|needs review/i.test(String(tx.status || '')) || /needs review|не определено|требует проверки/i.test(tx._category));
  const missingDate = rows.filter((tx) => !tx._date);
  const missingCategory = rows.filter((tx) => !tx.category || /needs review/i.test(tx._category));
  const currencies = [...new Set(rows.map((tx) => tx._currency))].sort();
  const mixedCurrencies = currencies.length > 1;
  const summarizeBasis = (basisRows, basis) => {
    let inflows = 0, outflows = 0, loanProceeds = 0, principalRepayments = 0, excludedTransfers = 0;
    const byCategory = new Map();
    const byMonth = new Map();
    const byCounterparty = new Map();
    for (const tx of basisRows) {
      const a = tx._amount;
      const cat = tx._category;
      if (isTransfer(tx)) { excludedTransfers += a; continue; }
      if (isLoanProceeds(tx)) {
        // Keep loan proceeds out of operating income; preserve reversals with their sign.
        loanProceeds += a;
        continue;
      }
      if (isPrincipalRepayment(tx)) {
        // Outflows are negative in this data model, so a normal repayment is positive here.
        // A positive reversal reduces the reported principal repayment amount.
        principalRepayments -= a;
        continue;
      }
      if (a > 0) inflows += a;
      if (a < 0) outflows += Math.abs(a);
      const categoryKey = `${tx._currency}::${cat}`;
      const entry = byCategory.get(categoryKey) || { currency: tx._currency, category: cat, income: 0, expense: 0, net: 0, count: 0 };
      if (a > 0) entry.income += a;
      if (a < 0) entry.expense += Math.abs(a);
      entry.net += a;
      entry.count++;
      byCategory.set(categoryKey, entry);
      const monthKey = `${tx._currency}::${tx._month}`;
      const month = byMonth.get(monthKey) || { currency: tx._currency, month: tx._month, inflows: 0, outflows: 0, net: 0, count: 0 };
      if (a > 0) month.inflows += a;
      if (a < 0) month.outflows += Math.abs(a);
      month.net += a;
      month.count++;
      byMonth.set(monthKey, month);
      const cp = String(tx.counterparty || tx.counterparty_name || 'Unknown counterparty').trim() || 'Unknown counterparty';
      const cpKey = `${tx._currency}::${cp}`;
      const cpEntry = byCounterparty.get(cpKey) || { currency: tx._currency, counterparty: cp, inflows: 0, outflows: 0, net: 0, count: 0 };
      if (a > 0) cpEntry.inflows += a;
      if (a < 0) cpEntry.outflows += Math.abs(a);
      cpEntry.net += a;
      cpEntry.count++;
      byCounterparty.set(cpKey, cpEntry);
    }
    const money = (obj) => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, typeof v === 'number' ? round(v) : v]));
    return {
      basis,
      transactionCount: basisRows.length,
      inflows: mixedCurrencies ? null : round(inflows),
      outflows: mixedCurrencies ? null : round(outflows),
      netCashMovement: mixedCurrencies ? null : round(inflows - outflows),
      financing: { loanProceeds: mixedCurrencies ? null : round(loanProceeds), principalRepayments: mixedCurrencies ? null : round(principalRepayments) },
      excludedInternalTransfersNet: round(excludedTransfers),
      categories: [...byCategory.values()].map(money).sort((a,b) => b.expense - a.expense),
      monthly: [...byMonth.values()].map(money).sort((a,b) => a.month.localeCompare(b.month)),
      counterparties: [...byCounterparty.values()].map(money).sort((a,b) => b.outflows - a.outflows).slice(0, 20)
    };
  };

  const cash = summarizeBasis(cashRows, 'cash');
  const accrual = summarizeBasis(accrualRows, 'accrual');
  const alerts = [];
  if (unknownRows.length) alerts.push({ severity: 'warning', code: 'BASIS_UNCONFIRMED', title: 'Accounting basis is not confirmed', count: unknownRows.length, explanation: 'These records are excluded from cash and accrual totals until their source basis is confirmed.' });
  if (reviewRows.length) alerts.push({ severity: 'warning', code: 'CLASSIFICATION_REVIEW', title: 'Transactions need classification review', count: reviewRows.length, explanation: 'Review these transactions before relying on category-level conclusions.' });
  if (missingDate.length) alerts.push({ severity: 'warning', code: 'MISSING_DATE', title: 'Transactions have no recognized date', count: missingDate.length, explanation: 'Undated records are shown separately and may not appear in period comparisons.' });
  if (currencies.length > 1) alerts.push({ severity: 'warning', code: 'MULTIPLE_CURRENCIES', title: 'Multiple currencies detected', count: currencies.length, currencies, explanation: 'Totals are not converted. Do not compare or sum currencies as if they were one currency.' });
  if (!accrualRows.length) alerts.push({ severity: 'info', code: 'NO_ACCRUAL_SOURCE', title: 'Full accrual P&L is not available', explanation: 'Only records explicitly marked as accrual basis can contribute to the accrual view. Cash movement is not the same as profit.' });
  if (cashRows.length && !accrualRows.length) alerts.push({ severity: 'info', code: 'CASH_ONLY_DATA', title: 'Cash view is available', explanation: 'Use this as cash movement analysis, not as a complete management P&L or balance sheet.' });
  const topExpense = !mixedCurrencies ? cash.categories.filter((x) => x.expense > 0 && !/loan principal|internal transfer/i.test(x.category)).sort((a,b) => b.expense - a.expense)[0] : null;
  if (topExpense) alerts.push({ severity: 'info', code: 'TOP_CASH_EXPENSE', title: 'Largest classified cash outflow category', category: topExpense.category, amount: topExpense.expense, explanation: 'This is a descriptive finding, not a causal diagnosis or recommendation by itself.' });

  return {
    generatedAt: new Date().toISOString(),
    dataScope: { transactionCount: rows.length, cashCount: cashRows.length, accrualCount: accrualRows.length, unconfirmedBasisCount: unknownRows.length, reviewCount: reviewRows.length, missingDateCount: missingDate.length, missingCategoryCount: missingCategory.length, currencies, dateRange: { from: rows.map(x => x._date).filter(Boolean).sort()[0] || null, to: rows.map(x => x._date).filter(Boolean).sort().at(-1) || null } },
    cash,
    accrual,
    managementPnl: accrualRows.length ? {
      status: 'provisional',
      note: 'This is a categorized accrual transaction summary, not yet a complete P&L. Revenue/expense recognition, period adjustments, tax treatment, and chart-of-accounts mapping must be validated.',
      income: accrual.inflows,
      expenses: accrual.outflows,
      netResultBeforeValidatedAdjustments: round(accrual.inflows - accrual.outflows),
      interestExpense: round(accrual.categories.filter(x => /interest expense/i.test(x.category)).reduce((s,x) => s + x.expense, 0))
    } : {
      status: 'unavailable',
      note: 'No transactions explicitly marked as accrual basis. A complete management P&L cannot be derived safely from cash-only records.'
    },
    alerts
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed' });
  }
  if (!process.env.DATABASE_URL) return send(res, 503, { error: 'Database connection is not configured', code: 'DATABASE_NOT_CONFIGURED' });
  const workspaceId = req.headers['x-workspace-id'];
  const token = req.headers['x-workspace-token'];
  if (!isUuid(workspaceId) || typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return send(res, 401, { error: 'A valid workspace credential is required', code: 'INVALID_CREDENTIALS' });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT payload, token_hash FROM public.dc_workspaces WHERE workspace_id = ${workspaceId}::uuid LIMIT 1`;
    const workspace = rows[0];
    if (!workspace || workspace.token_hash !== hashToken(token)) return send(res, 401, { error: 'Workspace credential was not accepted', code: 'INVALID_CREDENTIALS' });
    const payload = workspace.payload || {};
    if (!Array.isArray(payload.transactions)) return send(res, 422, { error: 'Workspace transactions are invalid' });
    return send(res, 200, { analytics: summarize(payload.transactions) });
  } catch (error) {
    console.error('Data Center analytics failed:', error);
    return send(res, 500, { error: 'Could not calculate Data Center analytics' });
  }
}
