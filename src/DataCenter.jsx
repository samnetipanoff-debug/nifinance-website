import React, { useEffect, useMemo, useRef, useState } from 'react';
import './data-center.css';

const STORAGE_KEY = 'nifinance-data-center-v1';
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
function parseCSV(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  const delimiter = candidates.sort((a,b) => first.split(b).length - first.split(a).length)[0];
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
  return normalized.findIndex(h => variants.some(v => h === norm(v) || h.includes(norm(v))));
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
function readRows(text, rules, fileName) {
  const table = parseCSV(text);
  if (table.length < 2) throw new Error('The file does not contain a header and data rows.');
  const headers = table[0];
  const dateI = fieldIndex(headers, ['date', 'transaction date', 'booking date', 'value date', 'датa', 'дата', 'datum']);
  const amountI = fieldIndex(headers, ['amount', 'transaction amount', 'iznos', 'износ', 'sum', 'сумма']);
  const debitI = fieldIndex(headers, ['debit', 'outgoing', 'withdrawal', 'duguje', 'расход', 'списание']);
  const creditI = fieldIndex(headers, ['credit', 'incoming', 'deposit', 'potrazuje', 'доход', 'поступление']);
  const nameI = fieldIndex(headers, ['counterparty', 'beneficiary', 'payer', 'merchant', 'partner', 'payee', 'противоположная сторона', 'контрагент', 'прималац', 'назив']);
  const descI = fieldIndex(headers, ['description', 'purpose', 'details', 'payment purpose', 'narrative', 'описание', 'назначение', 'сврха']);
  const refI = fieldIndex(headers, ['reference', 'transaction id', 'document number', 'id', 'poziv na broj', 'референс']);
  if (dateI < 0 || (amountI < 0 && debitI < 0 && creditI < 0)) throw new Error('Could not confidently identify date and amount columns. Use a CSV with date and amount, or debit/credit columns.');
  return table.slice(1).map((cells, i) => {
    const get = idx => idx < 0 ? '' : (cells[idx] || '');
    const debit = debitI >= 0 ? Math.abs(parseAmount(get(debitI))) : 0;
    const credit = creditI >= 0 ? Math.abs(parseAmount(get(creditI))) : 0;
    let amount = amountI >= 0 ? parseAmount(get(amountI)) : credit - debit;
    const description = get(descI) || (nameI >= 0 ? get(nameI) : '');
    const counterparty = get(nameI) || description || 'Unknown counterparty';
    const direction = amount > 0 ? 'income' : amount < 0 ? 'expense' : credit > 0 ? 'income' : 'expense';
    if (amountI < 0) amount = credit > 0 ? credit : -debit;
    const base = { id: 'imp-' + Date.now() + '-' + i, date: get(dateI), amount, currency: /€|eur/i.test(cells.join(' ')) ? 'EUR' : '—', counterparty, description, reference: get(refI), source: fileName, status: 'review', category: '', role: '', direction, original: cells };
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
    setError(''); setPreview([]); setFileName(file.name);
    try { const text = await file.text(); setPreview(readRows(text, rules, file.name)); }
    catch (e) { setError(e.message || 'Could not read this file.'); }
    event.target.value = '';
  };
  const commitImport = () => {
    const seen = new Set(transactions.map(t => t.fingerprint || [t.date,norm(t.counterparty),t.amount,norm(t.description),t.reference].join('|')));
    const accepted = preview.filter(t => { const fp = [t.date,norm(t.counterparty),t.amount,norm(t.description),t.reference].join('|'); if (seen.has(fp)) return false; seen.add(fp); t.fingerprint = fp; return true; });
    setTransactions(old => [...old, ...accepted]);
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
    <section className="dc-stats"><div><span>IMPORTED OPERATIONS</span><strong>{transactions.length.toLocaleString()}</strong><small>Stored in this browser</small></div><div><span>COUNTERPARTIES</span><strong>{counterparties.length.toLocaleString()}</strong><small>Generated from transaction history</small></div><div><span>RULES LEARNED</span><strong>{rules.length.toLocaleString()}</strong><small>Confirmed classification patterns</small></div><div className={reviewCount ? 'dc-stat-alert' : ''}><span>NEEDS REVIEW</span><strong>{reviewCount.toLocaleString()}</strong><small>Unconfirmed classifications</small></div></section>
    {cloudStatus === "offline" && <div className="dc-cloud-warning"><b>CLOUD STORAGE UNAVAILABLE</b><span>{cloudMessage} Check that DATABASE_URL is configured in Vercel. Avoid importing sensitive financial data until cloud storage is connected.</span></div>}
    {cloudStatus === "connected" && <div className="dc-cloud-note"><span className="dc-pulse"/> {cloudMessage} This prototype uses a private workspace token stored in this browser.</div>}\n    <section className="dc-workspace">
      <aside className="dc-sidebar"><div className="dc-section-tag">WORKSPACE</div>{[['transactions','01','Transactions'],['counterparties','02','Counterparties'],['rules','03','Classification rules'],['manual','04','Add operation']].map(([id,num,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{num}</span>{label}{id==='transactions'&&reviewCount>0&&<b>{reviewCount}</b>}</button>)}<div className="dc-sidebar-note"><span className="dc-pulse"/> CLASSIFICATION ENGINE ONLINE<small>Rule-based prototype · no external AI calls</small></div></aside>
      <div className="dc-main">
        {tab === 'transactions' && <><div className="dc-panel-head"><div><div className="dc-section-tag">FINANCIAL DATA / LEDGER</div><h2>Transaction ledger</h2><p>Every category remains traceable to the imported source row.</p></div><div className="dc-actions"><button className="dc-btn secondary" onClick={exportCSV} disabled={!transactions.length}>EXPORT CSV ↓</button><button className="dc-btn primary" onClick={()=>inputRef.current?.click()}>＋ IMPORT CSV</button><input ref={inputRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={onFile}/></div></div>
          <div className="dc-filterbar">{[['all','All operations'],['review','Needs review'],['income','Income'],['expense','Expenses']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}{id==='review'&&reviewCount>0?<b>{reviewCount}</b>:null}</button>)}</div>
          {error&&<div className="dc-error" role="alert">{error}</div>}
          {preview.length>0&&<div className="dc-preview"><div><b>IMPORT PREVIEW / {fileName}</b><span>{preview.length} rows detected · {preview.filter(t=>t.status==='review').length} need review · duplicates are skipped on import</span></div><div className="dc-actions"><button className="dc-btn secondary" onClick={()=>setPreview([])}>CANCEL</button><button className="dc-btn primary" onClick={commitImport}>IMPORT {preview.length} ROWS</button></div><div className="dc-preview-table"><table><thead><tr><th>Date</th><th>Counterparty</th><th>Amount</th><th>Suggested category</th><th>Confidence</th></tr></thead><tbody>{preview.slice(0,8).map(t=><tr key={t.id}><td>{t.date}</td><td>{t.counterparty}</td><td className={t.amount>0?'positive':'negative'}>{t.amount.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>{t.category}</td><td><span className={'dc-confidence '+t.confidence.toLowerCase()}>{t.confidence}</span></td></tr>)}</tbody></table>{preview.length>8&&<small>Showing 8 of {preview.length} rows</small>}</div></div>}
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
