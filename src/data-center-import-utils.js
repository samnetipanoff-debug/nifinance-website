const normalize = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, ' ').trim();

const BASIS_BY_SOURCE = {
  bank_statement: 'cash',
  accounting_journal: 'accrual',
  other: 'unknown'
};

export function transactionFingerprint(row = {}) {
  const base = [
    row.date,
    normalize(row.counterparty),
    Number(row.amount),
    normalize(row.description),
    String(row.reference || '').trim()
  ].join('|');
  const basis = row.accountingBasis || BASIS_BY_SOURCE[row.sourceType];
  // A bank movement and its accounting entry may describe the same business event.
  // Keep them as separate source records while still deduplicating within each basis.
  return basis ? basis + '|' + base : (row.fingerprint || base);
}
