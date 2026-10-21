import React, { useEffect, useMemo, useRef, useState } from 'react';
import './data-center.css';

const STORAGE_KEY = 'nifinance-data-center-v1';

// Decode bank exports before parsing. File.text() assumes UTF-8 and corrupts
// Cyrillic headers from common Windows-1251 exports, making column detection fail.
async function decodeStatementFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const startsWith = (...signature) => signature.every((value, index) => bytes[index] === value);
  if (startsWith(0xEF, 0xBB, 0xBF)) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (startsWith(0xFF, 0xFE)) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (startsWith(0xFE, 0xFF)) return new TextDecoder('utf-16be').decode(bytes.subarray(2));

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Many Russian-language bank exports are Windows-1251 rather than UTF-8.
    try {
      return new TextDecoder('windows-1251').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}
const CATEGORIES = [
  'Sales income', 'Other income', 'Marketing & advertising', 'Software & subscriptions',
  'Contractors & external services', 'Payroll & personnel', 'Rent & utilities',
  'Taxes & statutory payments', 'Bank fees', 'Travel & transport', 'Office & supplies',
  'Loan principal', 'Interest expense', 'Internal transfer', 'Refunds & reversals', 'Needs review'
];
const ROLE_LABELS = {
  customer: 'Customer', supplier: 'Supplier', contractor: 'Contractor', tax_authority: 'Tax authority',
  bank: 'Bank', employee: 'Employee', own_account: 'Own account', unknown: 'Unconfirmed'
};
const norm = (v = '') => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9а-яё]+/gi, ' ').trim();
const parseAmount = (v = '') => {
  let s = String(v).replace(/[€$£₽\s]/g, '').replace(/\((.*)\)/, '-$1');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return Number(s.replace(/[^0-9.\-]/g, '')) || 0;
};
function parseCSV(text, delimiterOverride = null) {
  // Choose a delimiter by consistency across several non-empty lines, not by the first
  // line alone: exports may start with a title, account metadata, or a quoted note.
  const sampleLines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).slice(0, 12);
  const candidates = [',', ';', '\t', '|'];
  const scoreDelimiter = delimiter => {
    const counts = sampleLines.map(line => {
      let quoted = false, count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"' && line[i + 1] === '"' && quoted) { i++; continue; }
        if (line[i] === '"') quoted = !quoted;
        else if (line[i] === delimiter && !quoted) count++;
      }
      return count;
    }).filter(n => n > 0);
    if (!counts.length) return 0;
    const max = Math.max(...counts);
    const consistent = counts.filter(n => n === max).length / counts.length;
    return max * consistent + Math.min(counts.length, 8) * 0.05;
  };
  const delimiter = delimiterOverride && [',', ';', '\t', '|'].includes(delimiterOverride) ? delimiterOverride : candidates.sort((a,b) => scoreDelimiter(b) - scoreDelimiter(a))[0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}
function fieldIndex(headers, variants) {
  const normalized = headers.map(norm);
  // Exact matches first; substring matches are a fallback to avoid matching generic
  // words such as "date" inside unrelated metadata columns.
  const exact = normalized.findIndex(h => variants.some(v => h === norm(v)));
  return exact >= 0 ? exact : normalized.findIndex(h => variants.some(v => h.length > 2 && h.includes(norm(v))));
}
function looksLikeDate(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  return /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(s) ||
    /^\d{1,2}\s+[A-Za-zА-Яа-яÀ-ÿ]{3,}\s+\d{2,4}$/.test(s);
}
function looksLikeAmount(value) {
  const s = String(value || '').trim();
  if (!s || looksLikeDate(s)) return false;
  const cleaned = s.replace(/[€$£₽\s'’]/g, '').replace(/[()]/g, '');
  return /^[-+]?(?:\d{1,3}(?:[., ]\d{3})+|\d+)?(?:[.,]\d{1,4})?$/.test(cleaned) && /\d/.test(cleaned);
}
function inferColumn(headers, rows, kind, excluded = []) {
  const sample = rows.slice(0, 40);
  const scores = headers.map((header, index) => {
    if (excluded.includes(index)) return { index, score: -1 };
    const values = sample.map(row => row[index] || '').filter(v => String(v).trim());
    if (!values.length) return { index, score: -1 };
    const matches = values.filter(kind === 'date' ? looksLikeDate : looksLikeAmount).length;
    return { index, score: matches / values.length };
  }).sort((a,b) => b.score - a.score);
  return scores[0]?.score >= (kind === 'date' ? 0.55 : 0.7) && scores[0].score > (scores[1]?.score || 0) + 0.05 ? scores[0].index : -1;
}
function guessCategory(description, counterparty, direction, amount) {
  const t = norm([description, counterparty].join(' '));
  if (/transfer|internal transfer|own account|перевод между|между счет|sopstveni racun/.test(t)) return 'Internal transfer';
  if (/tax|vat|porez|tax authority|porezi|contribution|doprin|налог|н алог|фнс|пдв|порез/.test(t)) return 'Taxes & statutory payments';
  if (/bank fee|commission|naknada|provizija|fee|п комиссия|банковская комиссия/.test(t)) return 'Bank fees';
  if (/refund|reversal|storno|povrat|возврат/.test(t)) return 'Refunds & reversals';
  if (/google ads|meta platforms|facebook ads|advertising|marketing|ads|reklam|oglas|яндекс директ/.test(t)) return 'Marketing & advertising';
  if (/subscription|software|hosting|cloud|github|adobe|notion|slack|software|softver/.test(t)) return 'Software & subscriptions';
  if (/salary|payroll|wage|plata|zarada|плата|зарплат/.test(t)) return 'Payroll & personnel';
  if (/rent|lease|electric|utilities|struja|zakup|закупка помещения|аренд/.test(t)) return 'Rent & utilities';
  if (/interest|kamata|процент по кредит/.test(t)) return 'Interest expense';
  if (/loan principal|credit repayment|otplata kredita|тело кредита/.test(t)) return 'Loan principal';
  if (/fuel|taxi|transport|travel|hotel|gorivo|putni|такси|бензин|командиров/.test(t)) return 'Travel & transport';
  if (/office|stationery|supplies|kancelarijski|канцеляр/.test(t)) return 'Office & supplies';
  if (direction === 'income' && amount > 0) return 'Sales income';
  if (direction === 'expense' && amount < 0) return 'Contractors & external services';
  return 'Needs review';
}
function guessRole(name, description, direction, category) {
  const t = norm([name, description].join(' '));
  if (!name) return 'unknown';
  if (/tax|porez|porezi|налог|фнс|пдв/.test(t) || category === 'Taxes & statutory payments') return 'tax_authority';
  if (/bank|banka|banc|банка|banking/.test(t) || category === 'Bank fees') return 'bank';
  if (/transfer|own account|sopstveni racun|между счет/.test(t) || category === 'Internal transfer') return 'own_account';
  if (/salary|employee|zarada|заработная плата/.test(t)) return 'employee';
  if (direction === 'income') return 'customer';
  if (/agency|studio|consult|development|marketing|contractor|services|usluge|услуг/.test(t)) return 'contractor';
  return 'supplier';
}
function classify(row, rules) {
  const key = norm(row.counterparty);
  const rule = rules.find(r => r.key && r.key === key);
  const category = rule?.category || guessCategory(row.description, row.counterparty, row.direction, row.amount);
  const role = rule?.role || guessRole(row.counterparty, row.description, row.direction, category);
  const certain = Boolean(rule) || category !== 'Needs review' && (role === 'tax_authority' || role === 'bank' || role === 'own_account' || /tax|bank fee|internal transfer|refund/i.test(category));
  return { ...row, category, role, confidence: rule ? 'Rule' : certain ? 'High' : category === 'Needs review' ? 'Low' : 'Suggested', status: rule || certain ? 'classified' : 'review' };
}
function readRows(text, rules, fileName, mapping = null) {
  const table = parseCSV(String(text).replace(/^\\uFEFF/, ''), mapping?.delimiter || null);
  if (table.length < 2) throw new Error('The file does not contain a header and data rows.');

  // Bank exports often place account details or report metadata above the real CSV header.
  const headerAliases = {
    date: ['date', 'transaction date', 'booking date', 'posting date', 'value date', 'operation date', 'transaction datetime', 'датa', 'дата', 'дата операции', 'дата проводки', 'дата валютирования', 'дата валюты', 'датум', 'datum transakcije', 'datum knjiženja', 'datum valute', 'datum placanja', 'datum plaćanja', 'datum obrade'],
    amount: ['amount', 'transaction amount', 'operation amount', 'sum', 'total amount', 'iznos', 'iznos transakcije', 'iznos u valuti', 'износ', 'сумма', 'сумма операции', 'сумма транзакции', 'сумма платежа'],
    debit: ['debit', 'debit amount', 'debit turnover', 'outgoing', 'withdrawal', 'paid out', 'duguje', 'zaduženje', 'zaduzenje', 'promet na teret', 'na teret', 'расход', 'списание', 'дебет', 'списано', 'исходящий платеж', 'izlaz', 'teret'],
    credit: ['credit', 'credit amount', 'credit turnover', 'incoming', 'deposit', 'paid in', 'potrazuje', 'potražuje', 'odobrenje', 'promet u korist', 'u korist', 'приход', 'поступление', 'зачисление', 'кредит', 'зачислено', 'входящий платеж', 'priliv', 'ulaz'],
    name: ['counterparty', 'beneficiary', 'payer', 'merchant', 'partner', 'payee', 'recipient', 'sender', 'account name', 'naziv nalogodavca', 'naziv primaoca', 'naziv primatelja', 'naziv', 'platilac', 'primalac', 'противоположная сторона', 'контрагент', 'плательщик', 'получатель', 'отправитель', 'название контрагента'],
    description: ['description', 'purpose', 'details', 'payment purpose', 'narrative', 'transaction details', 'reference description', 'описание', 'назначение', 'назначение платежа', 'детали операции', 'сврха', 'сврха плаћања', 'opis', 'opis transakcije', 'svrha placanja', 'svrha plaćanja'],
    reference: ['reference', 'transaction id', 'transaction number', 'document number', 'payment id', 'id transakcije', 'poziv na broj', 'референс', 'номер операции', 'номер транзакции', 'идентификатор операции'],
    currency: ['currency', 'valuta', 'валюта', 'валута трансакције']
  };
  const headerScore = cells => {
    const normalized = cells.map(v => norm(String(v).replace(/^\\uFEFF/, '')));
    const has = aliases => normalized.some(h => aliases.some(a => h === norm(a) || h.includes(norm(a))));
    return (has(headerAliases.date) ? 3 : 0) + (has(headerAliases.amount) ? 3 : 0) +
      ((has(headerAliases.debit) || has(headerAliases.credit)) ? 3 : 0) +
      (has(headerAliases.description) ? 1 : 0) + (has(headerAliases.name) ? 1 : 0);
  };
  let headerRowIndex = Number.isInteger(mapping?.headerRow) ? mapping.headerRow : 0;
  let bestScore = headerScore(table[headerRowIndex] || []);
  if (!Number.isInteger(mapping?.headerRow)) {
    for (let i = 1; i < Math.min(table.length - 1, 20); i++) {
      const score = headerScore(table[i]);
      if (score > bestScore) { bestScore = score; headerRowIndex = i; }
      if (score >= 6) break;
    }
  }
  const headers = table[headerRowIndex].map(v => String(v).replace(/^\\uFEFF/, '').trim());
  const rows = table.slice(headerRowIndex + 1);
  const debitI = fieldIndex(headers, headerAliases.debit);
  const creditI = fieldIndex(headers, headerAliases.credit);
  const dateNamedI = fieldIndex(headers, headerAliases.date);
  const amountNamedI = fieldIndex(headers, headerAliases.amount);
  // Universal fallback: infer unknown/localized headers from the actual cell values.
  // Never override a clear header match with a heuristic guess.
  const dateI = Number.isInteger(mapping?.date) ? mapping.date : (dateNamedI >= 0 ? dateNamedI : inferColumn(headers, rows, 'date'));
  const amountI = Number.isInteger(mapping?.amount) ? mapping.amount : (amountNamedI >= 0 ? amountNamedI : inferColumn(headers, rows, 'amount', [dateI, debitI, creditI].filter(i => i >= 0)));
  const mappedDebitI = Number.isInteger(mapping?.debit) ? mapping.debit : debitI;
  const mappedCreditI = Number.isInteger(mapping?.credit) ? mapping.credit : creditI;
  const nameI = Number.isInteger(mapping?.counterparty) ? mapping.counterparty : fieldIndex(headers, headerAliases.name);
  const descI = Number.isInteger(mapping?.description) ? mapping.description : fieldIndex(headers, headerAliases.description);
  const refI = Number.isInteger(mapping?.reference) ? mapping.reference : fieldIndex(headers, headerAliases.reference);
  const currencyI = Number.isInteger(mapping?.currency) ? mapping.currency : fieldIndex(headers, headerAliases.currency);
  if (dateI < 0 || (amountI < 0 && mappedDebitI < 0 && mappedCreditI < 0)) {
    const found = headers.filter(Boolean).slice(0, 20).join(', ');
    throw new Error('Could not confidently map the required date and amount fields. The importer checks header names and sample cell patterns, but this file needs column mapping before import. Detected columns: ' + (found || 'none') + '. No rows were imported.');
  }
  return rows.map((cells, i) => {
    const get = idx => idx < 0 ? '' : (cells[idx] || '');
    const debit = mappedDebitI >= 0 ? Math.abs(parseAmount(get(mappedDebitI))) : 0;
    const credit = mappedCreditI >= 0 ? Math.abs(parseAmount(get(mappedCreditI))) : 0;
    let amount = amountI >= 0 ? parseAmount(get(amountI)) : credit - debit;
    const description = get(descI) || (nameI >= 0 ? get(nameI) : '');
    const counterparty = get(nameI) || description || 'Unknown counterparty';
    const direction = amount > 0 ? 'income' : amount < 0 ? 'expense' : credit > 0 ? 'income' : 'expense';
    if (amountI < 0) amount = credit > 0 ? credit : -debit;
    const currencyText = currencyI >= 0 ? get(currencyI) : cells.join(' ');
    const base = {
      id: 'imp-' + Date.now() + '-' + i, date: get(dateI), amount,
      currency: /€|eur/i.test(currencyText) ? 'EUR' : /\\brsd\\b|дин|rsd/i.test(currencyText) ? 'RSD' : /\\busd\\b|\\$/i.test(currencyText) ? 'USD' : '—',
      counterparty, description, reference: get(refI), source: fileName, status: 'review', category: '', role: '', direction, original: cells
    };
    return classify(base, rules);
  }).filter(r => r.date || r.amount || r.description);
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
export default function DataCenter() {
  const [saved, setSaved] = useState(loadSaved);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('connecting');
  const [cloudMessage, setCloudMessage] = useState('');
  const [workspaceCredentials, setWorkspaceCredentials] = useState(null);
  const [preview, setPreview] = useState([]);
  const [mappingDraft, setMappingDraft] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('transactions');
  const [filter, setFilter] = useState('all');
  const [manual, setManual] = useState({ date: new Date().toISOString().slice(0,10), counterparty: '', description: '', amount: '', direction: 'expense', category: 'Needs review' });
  const inputRef = useRef(null);
  const transactions = saved.transactions || [];
  const rules = saved.rules || [];
  const counterparties = useMemo(() => {
    const map = new Map();
    transactions.forEach(t => {
      const key = norm(t.counterparty) || 'unknown';
      const old = map.get(key) || { key, name: t.counterparty || 'Unknown counterparty', roles: new Set(), count: 0, incoming: 0, outgoing: 0, categories: new Set() };
      old.roles.add(t.role || 'unknown'); old.count++; old.categories.add(t.category);
      if (t.amount > 0) old.incoming += t.amount; else old.outgoing += Math.abs(t.amount);
      map.set(key, old);
    });
    return [...map.values()].map(x => ({ ...x, roles: [...x.roles], categories: [...x.categories] })).sort((a,b) => b.count-a.count);
  }, [transactions]);
  const reviewCount = transactions.filter(t => t.status === 'review').length;
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {} }, [saved]);

  useEffect(() => {
    let cancelled = false;
    const connect = async () => {
      const localSnapshot = loadSaved();
      let credentials = null;
      try {
        credentials = JSON.parse(localStorage.getItem('nifinance-data-center-credentials-v1') || 'null');
      } catch {}
      const headers = credentials ? {
        'Content-Type': 'application/json',
        'X-Workspace-Id': credentials.workspaceId,
        'X-Workspace-Token': credentials.token
      } : { 'Content-Type': 'application/json' };
      try {
        if (!credentials?.workspaceId || !credentials?.token) {
          const createdResponse = await fetch('/api/data-center', {
            method: 'POST', headers, body: JSON.stringify({ action: 'create' })
          });
          const created = await createdResponse.json();
          if (!createdResponse.ok) throw new Error(created.error || 'Could not create a cloud workspace');
          credentials = { workspaceId: created.workspaceId, token: created.token };
          localStorage.setItem('nifinance-data-center-credentials-v1', JSON.stringify(credentials));
          if (cancelled) return;
          setWorkspaceCredentials(credentials);
          const hasLocalData = (localSnapshot.transactions || []).length || (localSnapshot.rules || []).length;
          if (hasLocalData) {
            const migrated = await fetch('/api/data-center', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': credentials.workspaceId, 'X-Workspace-Token': credentials.token },
              body: JSON.stringify({ action: 'save', payload: localSnapshot })
            });
            if (!migrated.ok) throw new Error('Cloud workspace was created, but existing browser data could not be migrated.');
            setSaved(localSnapshot);
          } else {
            setSaved(created.payload || { transactions: [], rules: [] });
          }
        } else {
          const response = await fetch('/api/data-center', { headers });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not load cloud workspace');
          const cloudPayload = result.payload || { transactions: [], rules: [] };
          const hasCloudData = (cloudPayload.transactions || []).length || (cloudPayload.rules || []).length;
          const hasLocalData = (localSnapshot.transactions || []).length || (localSnapshot.rules || []).length;
          if (!hasCloudData && hasLocalData) {
            const migrated = await fetch('/api/data-center', {
              method: 'POST',
              headers,
              body: JSON.stringify({ action: 'save', payload: localSnapshot })
            });
            if (!migrated.ok) throw new Error('Existing browser data could not be migrated to the cloud.');
            setSaved(localSnapshot);
          } else {
            setSaved(cloudPayload);
          }
          if (cancelled) return;
          setWorkspaceCredentials(credentials);
        }
        if (cancelled) return;
        setCloudStatus('connected');
        setCloudMessage('Changes sync to Neon PostgreSQL.');
        setCloudReady(true);
      } catch (e) {
        if (cancelled) return;
        setCloudStatus('offline');
        setCloudMessage(e.message || 'Cloud storage is unavailable. Data remains in this browser.');
        setCloudReady(false);
      }
    };
    connect();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cloudReady || !workspaceCredentials) return;
    const timer = setTimeout(async () => {
      setCloudStatus('saving');
      try {
        const response = await fetch('/api/data-center', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': workspaceCredentials.workspaceId,
            'X-Workspace-Token': workspaceCredentials.token
          },
          body: JSON.stringify({ action: 'save', payload: saved })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Cloud save failed');
        setCloudStatus('connected');
        setCloudMessage('All changes saved to Neon PostgreSQL.');
      } catch (e) {
        setCloudStatus('offline');
        setCloudMessage((e.message || 'Cloud save failed') + ' Data is still cached in this browser.');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [saved, cloudReady, workspaceCredentials]);

  const setTransactions = updater => setSaved(s => ({ ...s, transactions: typeof updater === 'function' ? updater(s.transactions || []) : updater }));
  const onFile = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    setError(''); setPreview([]); setMappingDraft(null); setFileName(file.name);
    try {
      const text = await decodeStatementFile(file);
      try {
        const rows = readRows(text, rules, file.name);
        const seen = new Set(transactions.map(fingerprintOf));
        setPreview(rows.map(row => {
          const fingerprint = fingerprintOf(row);
          const isDuplicate = seen.has(fingerprint);
          seen.add(fingerprint);
          return { ...row, fingerprint, isDuplicate };
        }));
      } catch (parseError) {
        // Stage 1: AI only identifies file structure. It never classifies transactions.
        // Only a small sample is sent; the full file remains in the browser.
        let aiMapping = null;
        try {
          const response = await fetch('/api/data-center-recognize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Workspace-Id': workspaceCredentials?.workspaceId || '',
              'X-Workspace-Token': workspaceCredentials?.token || ''
            },
            body: JSON.stringify({ fileName: file.name, sample: text.slice(0, 14000) })
          });
          const result = await response.json();
          if (response.ok && result.mapping && Number.isInteger(result.mapping.headerRow)) aiMapping = result.mapping;
          else if (!response.ok) console.warn('AI structure recognition unavailable:', result.error || response.status);
        } catch (aiError) {
          console.warn('AI structure recognition unavailable:', aiError);
        }
        if (aiMapping) {
          try {
            const rows = readRows(text, rules, file.name, aiMapping);
            const seen = new Set(transactions.map(fingerprintOf));
            setPreview(rows.map(row => {
              const fingerprint = fingerprintOf(row);
              const isDuplicate = seen.has(fingerprint);
              seen.add(fingerprint);
              return { ...row, fingerprint, isDuplicate };
            }));
            setError('AI identified the file structure. Review the preview carefully before importing; operation classification is a separate step.');
            return;
          } catch (aiParseError) {
            console.warn('AI mapping did not pass deterministic validation:', aiParseError);
          }
        }
        // Fallback: keep the file in memory and offer explicit column mapping.
        const table = parseCSV(text.replace(/^\uFEFF/, ''));
        const headerIndex = table.findIndex((row, index) => index < Math.min(table.length - 1, 30) &&
          row.filter(cell => /[A-Za-zА-Яа-яÀ-ÿ]/.test(String(cell))).length >= 2 &&
          row.some(cell => looksLikeDate(cell)) === false);
        if (headerIndex >= 0 && table.length > headerIndex + 1) {
          const headers = table[headerIndex].map((h, i) => String(h || '').trim() || ('Column ' + (i + 1)));
          const rows = table.slice(headerIndex + 1);
          const dateGuess = inferColumn(headers, rows, 'date');
          const amountGuess = inferColumn(headers, rows, 'amount', [dateGuess].filter(i => i >= 0));
          const findGuess = (terms) => headers.findIndex(h => terms.some(term => norm(h) === norm(term) || norm(h).includes(norm(term))));
          setMappingDraft({
            text, headers, headerIndex,
            mapping: {
              date: fieldIndex(headers, ['date','datum','дата','дата операции']) >= 0 ? fieldIndex(headers, ['date','datum','дата','дата операции']) : dateGuess,
              amount: fieldIndex(headers, ['amount','iznos','сумма','износ']) >= 0 ? fieldIndex(headers, ['amount','iznos','сумма','износ']) : amountGuess,
              debit: findGuess(['debit','duguje','дебет','списание']),
              credit: findGuess(['credit','potražuje','кредит','зачисление']),
              counterparty: findGuess(['counterparty','beneficiary','payer','naziv','контрагент','получатель','плательщик']),
              description: findGuess(['description','purpose','details','описание','назначение','svrha']),
              reference: findGuess(['reference','transaction id','номер операции','poziv na broj']),
              currency: findGuess(['currency','valuta','валюта'])
            }
          });
          setError('Automatic and AI recognition could not confirm the required fields. Map the columns below; nothing has been imported yet.');
        } else {
          setError(parseError.message || 'Could not read this file.');
        }
      }
    } catch (e) { setError(e.message || 'Could not read this file.'); }
    event.target.value = '';
  };
  const applyColumnMapping = () => {
    if (!mappingDraft) return;
    try {
      const rows = readRows(mappingDraft.text, rules, fileName, { ...mappingDraft.mapping, headerRow: mappingDraft.headerIndex });
      const seen = new Set(transactions.map(fingerprintOf));
      setPreview(rows.map(row => {
        const fingerprint = fingerprintOf(row);
        const isDuplicate = seen.has(fingerprint);
        seen.add(fingerprint);
        return { ...row, fingerprint, isDuplicate };
      }));
      setMappingDraft(null);
      setError('');
    } catch (e) {
      setError((e.message || 'Column mapping is incomplete.') + ' Select a date and either amount or debit/credit columns.');
    }
  };
  const mappingFields = [
    ['date','Date *'], ['amount','Signed amount'], ['debit','Debit / outgoing'], ['credit','Credit / incoming'],
    ['counterparty','Counterparty'], ['description','Description / purpose'], ['reference','Reference / transaction ID'], ['currency','Currency']
  ];
  const fingerprintOf = row => row.fingerprint || [row.date, norm(row.counterparty), Number(row.amount), norm(row.description), String(row.reference || '').trim()].join('|');
  const duplicateCount = preview.filter(t => t.isDuplicate).length;
  const newPreviewCount = preview.length - duplicateCount;
  const commitImport = () => {
    const importId = 'import-' + Date.now();
    const accepted = preview.filter(t => !t.isDuplicate).map(t => ({ ...t, fingerprint: fingerprintOf(t), isDuplicate: undefined }));
    const importRecord = {
      id: importId, sourceName: fileName, importedAt: new Date().toISOString(),
      totalRows: preview.length, importedCount: accepted.length, skippedCount: duplicateCount,
      status: 'completed'
    };
    setSaved(s => {
      const existing = s.transactions || [];
      const seen = new Set(existing.map(fingerprintOf));
      const unique = accepted.filter(t => {
        const fp = fingerprintOf(t);
        if (seen.has(fp)) return false;
        seen.add(fp);
        return true;
      });
      const record = { ...importRecord, importedCount: unique.length, skippedCount: preview.length - unique.length };
      return {
        ...s,
        transactions: [...existing, ...unique],
        imports: [record, ...(s.imports || []).filter(item => item.id !== record.id)].slice(0, 100)
      };
    });
    setPreview([]); setError('');
    setTab('transactions');
  };
  const updateTransaction = (id, patch, learn = false) => {
    const current = transactions.find(t => t.id === id); if (!current) return;
    const next = { ...current, ...patch, status: 'classified', confidence: learn ? 'Rule' : 'Confirmed' };
    setTransactions(old => old.map(t => t.id === id ? next : t));
    if (learn) {
      const key = norm(next.counterparty);
      setSaved(s => ({ ...s, rules: [...(s.rules || []).filter(r => r.key !== key), { key, counterparty: next.counterparty, category: next.category, role: next.role, updatedAt: new Date().toISOString() }] }));
      setTransactions(old => old.map(t => norm(t.counterparty) === key ? { ...t, category: next.category, role: next.role, status: 'classified', confidence: 'Rule' } : t));
    }
  };
  const addManual = e => {
    e.preventDefault();
    const amount = Math.abs(parseAmount(manual.amount)) * (manual.direction === 'income' ? 1 : -1);
    const row = classify({ ...manual, id: 'manual-' + Date.now(), amount, currency: '—', source: 'Manual entry', reference: '', original: [], direction: manual.direction }, rules);
    setTransactions(old => [...old, { ...row, category: manual.category, status: manual.category === 'Needs review' ? 'review' : 'classified', confidence: 'Confirmed' }]);
    setManual(v => ({ ...v, counterparty: '', description: '', amount: '' }));
    setTab('transactions');
  };
  const filtered = transactions.filter(t => filter === 'all' || (filter === 'review' ? t.status === 'review' : filter === 'income' ? t.amount > 0 : t.amount < 0));
  const exportCSV = () => {
    const rows = [['Date','Counterparty','Role','Description','Amount','Currency','Category','Status','Source'], ...transactions.map(t => [t.date,t.counterparty,ROLE_LABELS[t.role] || t.role,t.description,t.amount,t.currency,t.category,t.status,t.source])];
    const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'nifinance-classified-transactions.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return <main className="dc-page">
    <header className="dc-topbar"><a className="dc-brand" href="/"><span className="dc-mark">N</span><span>NIFINANCE <i>SOLUTION</i></span></a><div className={"dc-status " + cloudStatus}><span /> {cloudStatus === "connected" ? "NEON SYNC / SAVED" : cloudStatus === "saving" ? "NEON SYNC / SAVING" : cloudStatus === "connecting" ? "CONNECTING TO NEON" : "LOCAL CACHE / OFFLINE"}</div><a className="dc-back" href="/universe-3">BACK TO UNIVERSE ↗</a></header>
    <section className="dc-hero"><div><div className="dc-eyebrow">DATA INFRASTRUCTURE / 01</div><h1>From raw data<br/><em>to business meaning.</em></h1><p>Import financial transactions. Identify counterparties. Build a consistent management view — with uncertain decisions kept visible.</p></div><div className="dc-hero-orb"><span /><i /><b>DATA<br/>INTELLIGENCE</b></div></section>
    <section className="dc-stats"><div><span>IMPORTED OPERATIONS</span><strong>{transactions.length.toLocaleString()}</strong><small>{cloudStatus==='connected'?'Synced with Neon PostgreSQL':'Browser cache / cloud status above'}</small></div><div><span>COUNTERPARTIES</span><strong>{counterparties.length.toLocaleString()}</strong><small>Generated from transaction history</small></div><div><span>RULES LEARNED</span><strong>{rules.length.toLocaleString()}</strong><small>Confirmed classification patterns</small></div><div className={reviewCount ? 'dc-stat-alert' : ''}><span>NEEDS REVIEW</span><strong>{reviewCount.toLocaleString()}</strong><small>Unconfirmed classifications</small></div></section>
    {cloudStatus === "offline" && <div className="dc-cloud-warning"><b>CLOUD STORAGE UNAVAILABLE</b><span>{cloudMessage} Check that DATABASE_URL is configured in Vercel. Avoid importing sensitive financial data until cloud storage is connected.</span></div>}
    {cloudStatus === "connected" && <div className="dc-cloud-note"><span className="dc-pulse"/> {cloudMessage} This prototype uses a private workspace token stored in this browser.</div>}\n    <section className="dc-workspace">
      <aside className="dc-sidebar"><div className="dc-section-tag">WORKSPACE</div>{[['transactions','01','Transactions'],['counterparties','02','Counterparties'],['rules','03','Classification rules'],['manual','04','Add operation']].map(([id,num,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{num}</span>{label}{id==='transactions'&&reviewCount>0&&<b>{reviewCount}</b>}</button>)}<div className="dc-sidebar-note"><span className="dc-pulse"/> CLASSIFICATION ENGINE ONLINE<small>Rule-based prototype · no external AI calls</small></div></aside>
      <div className="dc-main">
        {tab === 'transactions' && <><div className="dc-panel-head"><div><div className="dc-section-tag">FINANCIAL DATA / LEDGER</div><h2>Transaction ledger</h2><p>Every category remains traceable to the imported source row.</p></div><div className="dc-actions"><button className="dc-btn secondary" onClick={exportCSV} disabled={!transactions.length}>EXPORT CSV ↓</button><button className="dc-btn primary" onClick={()=>inputRef.current?.click()}>＋ IMPORT CSV</button><input ref={inputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={onFile}/></div></div>
          <div className="dc-filterbar">{[['all','All operations'],['review','Needs review'],['income','Income'],['expense','Expenses']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}{id==='review'&&reviewCount>0?<b>{reviewCount}</b>:null}</button>)}</div>
          {error&&<div className="dc-error" role="alert">{error}</div>}
          {mappingDraft&&<div className="dc-preview dc-column-mapping">
            <div><b>MAP CSV COLUMNS / {fileName}</b><span>Automatic recognition was uncertain. Select the matching columns. Required: Date and either Signed amount or Debit/Credit. No data is imported until you confirm the preview.</span></div>
            <div className="dc-manual-form">{mappingFields.map(([key,label])=><label key={key}>{label}<select value={mappingDraft.mapping[key] ?? -1} onChange={e=>setMappingDraft(d=>({...d,mapping:{...d.mapping,[key]:Number(e.target.value)}}))}>
              <option value={-1}>— Not mapped —</option>{mappingDraft.headers.map((header,index)=><option key={index} value={index}>{header}</option>)}
            </select></label>)}</div>
            <div className="dc-actions"><button className="dc-btn secondary" onClick={()=>{setMappingDraft(null);setError('');}}>CANCEL</button><button className="dc-btn primary" onClick={applyColumnMapping}>APPLY MAPPING & PREVIEW</button></div>
          </div>}
                    {preview.length>0&&<div className="dc-preview"><div><b>IMPORT PREVIEW / {fileName}</b><span>{preview.length} rows detected · {newPreviewCount} new · {duplicateCount} duplicates will be skipped · {preview.filter(t=>t.status==='review'&&!t.isDuplicate).length} need review</span></div><div className="dc-actions"><button className="dc-btn secondary" onClick={()=>setPreview([])}>CANCEL</button><button className="dc-btn primary" onClick={commitImport} disabled={newPreviewCount===0}>IMPORT {newPreviewCount} NEW ROWS</button></div><div className="dc-preview-table"><table><thead><tr><th>Date</th><th>Counterparty</th><th>Amount</th><th>Suggested category</th><th>Confidence</th><th>Import check</th></tr></thead><tbody>{preview.slice(0,8).map(t=><tr key={t.id}><td>{t.date}</td><td>{t.counterparty}</td><td className={t.amount>0?'positive':'negative'}>{t.amount.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>{t.category}</td><td><span className={'dc-confidence '+t.confidence.toLowerCase()}>{t.confidence}</span></td><td><span className={'dc-confidence '+(t.isDuplicate?'low':'high')}>{t.isDuplicate?'DUPLICATE':'NEW'}</span></td></tr>)}</tbody></table>{preview.length>8&&<small>Showing 8 of {preview.length} rows</small>}</div></div>}
          {(saved.imports||[]).length>0&&<div className="dc-import-history"><div className="dc-section-tag">IMPORT HISTORY / LAST 5</div>{(saved.imports||[]).slice(0,5).map(item=><div className="dc-import-row" key={item.id}><div><b>{item.sourceName||'Imported file'}</b><small>{item.importedAt?new Date(item.importedAt).toLocaleString():''}</small></div><span>{item.importedCount} added</span><span>{item.skippedCount} skipped</span></div>)}</div>}
          <div className="dc-table-wrap">{filtered.length===0?<div className="dc-empty"><div>↳</div><h3>{transactions.length?'No operations match this filter':'Your ledger starts with a file.'}</h3><p>Upload a bank CSV statement to preview detected columns, classify transactions and create counterparty records.</p><button className="dc-btn primary" onClick={()=>inputRef.current?.click()}>IMPORT FIRST CSV</button></div>:<table className="dc-ledger"><thead><tr><th>DATE / SOURCE</th><th>COUNTERPARTY</th><th>TYPE</th><th>AMOUNT</th><th>CATEGORY</th><th>CONFIDENCE</th><th>ACTION</th></tr></thead><tbody>{filtered.slice().reverse().map(t=><tr key={t.id}><td><b>{t.date||'—'}</b><small>{t.source}</small></td><td><b>{t.counterparty}</b><small>{t.description}</small></td><td><span className={'dc-direction '+(t.amount>0?'income':'expense')}>{t.amount>0?'INCOME':'OUTFLOW'}</span><small>{ROLE_LABELS[t.role]||'Unconfirmed'}</small></td><td className={'dc-amount '+(t.amount>0?'positive':'negative')}>{t.amount>0?'+':''}{t.amount.toLocaleString(undefined,{maximumFractionDigits:2})} <small>{t.currency}</small></td><td><select value={t.category} onChange={e=>updateTransaction(t.id,{category:e.target.value},false)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><select value={t.role} onChange={e=>updateTransaction(t.id,{role:e.target.value},false)}>{Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td><span className={'dc-confidence '+String(t.confidence).toLowerCase()}>{t.confidence}</span>{t.status==='review'&&<small className="dc-review-label">Review needed</small>}</td><td><button className="dc-mini-action" title="Confirm this classification" onClick={()=>updateTransaction(t.id,{category:t.category,role:t.role},false)}>CONFIRM</button><button className="dc-mini-action learn" title="Save this rule for future transactions from this counterparty" onClick={()=>updateTransaction(t.id,{category:t.category,role:t.role},true)}>SAVE RULE</button></td></tr>)}</tbody></table>}</div>
        </>}
        {tab === 'counterparties' && <><div className="dc-panel-head"><div><div className="dc-section-tag">MASTER DATA / DIRECTORY</div><h2>Counterparty directory</h2><p>Built automatically from imported transactions. Roles can overlap.</p></div><span className="dc-count">{counterparties.length} RECORDS</span></div>{!counterparties.length?<div className="dc-empty"><h3>No counterparties yet</h3><p>Import a CSV statement. The system will create directory candidates from transaction names.</p></div>:<div className="dc-counterparty-grid">{counterparties.map(c=><article className="dc-counterparty" key={c.key}><div className="dc-counterparty-top"><span className="dc-avatar">{(c.name[0]||'?').toUpperCase()}</span><span className="dc-confidence suggested">{c.count} OPS</span></div><h3>{c.name}</h3><div className="dc-role-list">{c.roles.map(r=><span key={r}>{ROLE_LABELS[r]||r}</span>)}</div><div className="dc-counterparty-stats"><div><small>RECEIVED</small><b className="positive">{c.incoming.toLocaleString(undefined,{maximumFractionDigits:2})}</b></div><div><small>PAID</small><b className="negative">{c.outgoing.toLocaleString(undefined,{maximumFractionDigits:2})}</b></div></div><small className="dc-category-list">{c.categories.join(' · ')}</small></article>)}</div>}</>}
        {tab === 'rules' && <><div className="dc-panel-head"><div><div className="dc-section-tag">LEARNING / DECISION HISTORY</div><h2>Classification rules</h2><p>Rules saved from your confirmed decisions are applied to future imports.</p></div><span className="dc-count">{rules.length} RULES</span></div>{!rules.length?<div className="dc-empty"><h3>No saved rules yet</h3><p>In Transactions, adjust a category and role, then choose SAVE RULE. Matching future transactions will reuse that decision.</p><button className="dc-btn secondary" onClick={()=>setTab('transactions')}>OPEN TRANSACTIONS ↗</button></div>:<div className="dc-table-wrap"><table className="dc-ledger"><thead><tr><th>COUNTERPARTY MATCH</th><th>ROLE</th><th>CATEGORY</th><th>LAST UPDATED</th><th></th></tr></thead><tbody>{rules.map(r=><tr key={r.key}><td><b>{r.counterparty}</b><small>Exact normalized name match</small></td><td>{ROLE_LABELS[r.role]||r.role}</td><td>{r.category}</td><td>{new Date(r.updatedAt).toLocaleDateString()}</td><td><button className="dc-mini-action" onClick={()=>setSaved(s=>({...s,rules:s.rules.filter(x=>x.key!==r.key)}))}>DELETE RULE</button></td></tr>)}</tbody></table></div>}</>}
        {tab === 'manual' && <><div className="dc-panel-head"><div><div className="dc-section-tag">MANUAL ENTRY / LEDGER</div><h2>Add an operation</h2><p>Enter a transaction not present in a source file.</p></div></div><form className="dc-manual-form" onSubmit={addManual}><label>Operation date<input type="date" value={manual.date} onChange={e=>setManual(s=>({...s,date:e.target.value}))} required/></label><label>Direction<select value={manual.direction} onChange={e=>setManual(s=>({...s,direction:e.target.value}))}><option value="expense">Expense / outgoing</option><option value="income">Income / incoming</option></select></label><label>Counterparty<input value={manual.counterparty} onChange={e=>setManual(s=>({...s,counterparty:e.target.value}))} placeholder="Company or person" required/></label><label>Amount<input type="number" step="0.01" min="0.01" value={manual.amount} onChange={e=>setManual(s=>({...s,amount:e.target.value}))} placeholder="0.00" required/></label><label className="wide">Description / payment purpose<input value={manual.description} onChange={e=>setManual(s=>({...s,description:e.target.value}))} placeholder="Invoice, tax, service, transfer…"/></label><label className="wide">Category<select value={manual.category} onChange={e=>setManual(s=>({...s,category:e.target.value}))}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><div className="dc-manual-foot"><p>Manual entries sync to your workspace when cloud storage is connected; a browser cache is also kept.</p><button className="dc-btn primary" type="submit">＋ ADD OPERATION</button></div></form></>}
      </div>
    </section>
    <footer className="dc-footer"><span>NIFINANCE SOLUTION / DATA CENTER</span><span>RAW SOURCE → NORMALIZED RECORD → VERIFIED DECISION</span><span>NEON WORKSPACE · NO BANK CONNECTION</span></footer>
  </main>;
}
