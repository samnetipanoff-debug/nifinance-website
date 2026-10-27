import { neon } from '@neondatabase/serverless';
import { isWorkspaceId, isWorkspaceToken, workspaceTokenMatches } from './_lib/workspace-auth.js';
import { summarize as summarizeFinance } from './data-center-analytics.js';
const norm = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яё]+/gi,' ').trim();

const send=(res,status,body)=>res.status(status).json(body);
const clean=(v,n=180)=>String(v??'').slice(0,n);
const objectKey=(type,id)=>type&&id?`${String(type).toLowerCase()}:${String(id)}`:null;

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return send(res,405,{error:'Method not allowed'});}
 if(!process.env.DATABASE_URL)return send(res,503,{error:'Database connection is not configured'});
 const workspaceId=req.headers['x-workspace-id'],token=req.headers['x-workspace-token'];
 if(!isWorkspaceId(workspaceId)||!isWorkspaceToken(token))return send(res,401,{error:'A valid workspace credential is required'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  const w=await sql`SELECT token_hash,payload FROM public.dc_workspaces WHERE workspace_id=${workspaceId}::uuid LIMIT 1`;
  if(!w[0]||!workspaceTokenMatches(w[0].token_hash,token))return send(res,401,{error:'Workspace credential was not accepted'});
  if(req.method==='POST'){
   const body=req.body||{};
   if(body.action!=='match.confirm')return send(res,400,{error:'Unsupported graph action'});
   const transactionKey=clean(body.transactionKey,240),recordType=String(body.matchedRecordType||''),recordId=String(body.matchedRecordId||'');
   if(!transactionKey||!['contact','deal'].includes(recordType)||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(recordId))return send(res,400,{error:'Choose a transaction and a valid CRM contact or deal'});
   const tx=await sql`SELECT id FROM public.dc_transactions WHERE workspace_id=${workspaceId}::uuid AND transaction_key=${transactionKey} LIMIT 1`;
   if(!tx.length)return send(res,404,{error:'Data Center transaction not found in this workspace'});
   const targetTable=recordType==='contact'?'public.bh_contacts':'public.bh_deals';
   const target=recordType==='contact'
    ? await sql`SELECT id FROM public.bh_contacts WHERE id=${recordId}::uuid AND workspace_id=${workspaceId}::uuid LIMIT 1`
    : await sql`SELECT id FROM public.bh_deals WHERE id=${recordId}::uuid AND workspace_id=${workspaceId}::uuid LIMIT 1`;
   if(!target.length)return send(res,404,{error:'CRM record not found in this workspace'});
   await sql`UPDATE public.dc_transaction_matches SET status='replaced',updated_at=NOW() WHERE workspace_id=${workspaceId}::uuid AND transaction_id=${tx[0].id}::uuid AND status IN ('confirmed','accepted','linked') AND (matched_record_type<>${recordType} OR matched_record_id<>${recordId})`;
   const existing=await sql`SELECT id FROM public.dc_transaction_matches WHERE workspace_id=${workspaceId}::uuid AND transaction_id=${tx[0].id}::uuid AND matched_record_type=${recordType} AND matched_record_id=${recordId} LIMIT 1`;
   if(existing.length)await sql`UPDATE public.dc_transaction_matches SET match_type='manual',confidence=1,status='confirmed',match_data=jsonb_build_object('source','Business Universe manual review'),updated_at=NOW() WHERE id=${existing[0].id}::uuid`;
   else await sql`INSERT INTO public.dc_transaction_matches(workspace_id,transaction_id,match_type,matched_record_type,matched_record_id,confidence,status,match_data) VALUES(${workspaceId}::uuid,${tx[0].id}::uuid,'manual',${recordType},${recordId},1,'confirmed',jsonb_build_object('source','Business Universe manual review'))`;
   return send(res,200,{ok:true,transactionKey,matchedRecordType:recordType,matchedRecordId:recordId,status:'confirmed'});
  }
  const [contacts,deals,tasks,channels,findings,chatSummary,manualMatches]=await Promise.all([
   sql`SELECT id,name,kind,status FROM public.bh_contacts WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 150`,
   sql`SELECT d.id,d.title,d.stage,d.amount,d.currency,d.contact_id,c.name AS contact_name,c.company AS contact_company FROM public.bh_deals d LEFT JOIN public.bh_contacts c ON c.id=d.contact_id AND c.workspace_id=d.workspace_id WHERE d.workspace_id=${workspaceId}::uuid ORDER BY d.updated_at DESC LIMIT 150`,
   sql`SELECT id,title,status,priority,linked_object_type,linked_object_id FROM public.bh_tasks WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 150`,
   sql`SELECT id,name,channel_type,linked_object_type,linked_object_id FROM public.bh_chat_channels WHERE workspace_id=${workspaceId}::uuid AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
   sql`SELECT id,title,finding_type,severity,status FROM public.bh_core_findings WHERE workspace_id=${workspaceId}::uuid ORDER BY created_at DESC LIMIT 100`,
   sql`SELECT COUNT(DISTINCT c.id)::int AS channels,COUNT(m.id)::int AS messages,COUNT(m.id) FILTER(WHERE m.created_at>NOW()-INTERVAL '30 days')::int AS messages_30d FROM public.bh_chat_channels c LEFT JOIN public.bh_chat_messages m ON m.channel_id=c.id AND m.workspace_id=c.workspace_id AND m.deleted_at IS NULL WHERE c.workspace_id=${workspaceId}::uuid AND c.archived_at IS NULL`,
   sql`SELECT t.transaction_key,m.matched_record_type,m.matched_record_id,m.status FROM public.dc_transaction_matches m JOIN public.dc_transactions t ON t.id=m.transaction_id AND t.workspace_id=m.workspace_id WHERE m.workspace_id=${workspaceId}::uuid AND m.status IN ('confirmed','accepted','linked')`
  ]);
  const nodes=[],edges=[],seen=new Set();
  const add=(type,id,label,meta={})=>{if(!id)return;const key=objectKey(type,id);if(seen.has(key))return;seen.add(key);nodes.push({id:key,type,label:clean(label),meta});};
  const edge=(from,to,kind,label)=>{if(!from||!to||from===to)return;edges.push({id:`${kind}:${from}:${to}`,from,to,kind,label:clean(label,80)});};
  contacts.forEach(c=>add('contact',c.id,c.name,{kind:c.kind,status:c.status}));
  deals.forEach(d=>{add('deal',d.id,d.title,{stage:d.stage,amount:d.amount==null?null:Number(d.amount),currency:d.currency?.trim()||null});if(d.contact_id)edge(objectKey('contact',d.contact_id),objectKey('deal',d.id),'contact-deal','owns / associated with');});
  tasks.forEach(t=>{add('task',t.id,t.title,{status:t.status,priority:t.priority});const target=objectKey(t.linked_object_type,t.linked_object_id);if(target&&seen.has(target))edge(target,objectKey('task',t.id),'linked-task','has task');});
  channels.forEach(c=>{add('channel',c.id,c.name,{channelType:c.channel_type});const target=objectKey(c.linked_object_type,c.linked_object_id);if(target&&seen.has(target))edge(target,objectKey('channel',c.id),'linked-channel','discussed in');});
  findings.forEach(f=>{add('finding',f.id,f.title,{findingType:f.finding_type,severity:f.severity,status:f.status});});
  const transactions=Array.isArray(w[0].payload?.transactions)?w[0].payload.transactions:[];
  const normalizedContacts=contacts.map(c=>({id:c.id,keys:[norm(c.name),norm(c.company)].filter(Boolean)}));
  const normalizedDeals=deals.map(d=>({id:d.id,keys:[norm(d.title),norm(d.contact_name),norm(d.contact_company)].filter(Boolean)}));
  const financialEdges=[];
  const manualByKey=new Map();
  manualMatches.forEach(match=>{const key=String(match.transaction_key);if(!manualByKey.has(key))manualByKey.set(key,[]);manualByKey.get(key).push(match);});
  const financeNodes=transactions.slice(0,500).map((tx,index)=>{
   const id=String(tx.id||tx.fingerprint||`legacy-${index}`);
   const nodeId=objectKey('transaction',id);
   const label=clean(tx.description||tx.counterparty||tx.counterparty_name||tx.category||tx.categoryName||`Transaction ${index+1}`,180);
   const basis=String(tx.basis||tx.accountingBasis||tx.sourceBasis||tx.sourceType||'unknown');
   add('transaction',id,label,{transactionKey:id,date:tx.date||tx.transaction_date||null,amount:Number(tx.amount||0),currency:String(tx.currency||'').toUpperCase()||'UNSPECIFIED',direction:tx.direction||null,category:tx.category||tx.categoryName||'Needs review',counterparty:tx.counterparty||tx.counterparty_name||null,basis,source:tx.source||null,status:tx.status||null,description:clean(tx.description||'',500)});
   let linkedToCrm=false;
   const confirmed=manualByKey.get(id)||[];
   if(confirmed.length){
    confirmed.forEach(match=>{const target=objectKey(match.matched_record_type,match.matched_record_id);if(seen.has(target)){edge(target,nodeId,'manual-finance-link','manually confirmed relationship');linkedToCrm=true;}});
   }else{
    const cp=norm(tx.counterparty||tx.counterparty_name||'');
    if(cp){
     const matches=normalizedContacts.filter(c=>c.keys.includes(cp));
     if(matches.length===1){const target=objectKey('contact',matches[0].id);edge(target,nodeId,'counterparty-transaction','exact counterparty match');linkedToCrm=true;}
     const matchingDeals=normalizedDeals.filter(d=>d.keys.includes(cp));
     if(matchingDeals.length===1){edge(objectKey('deal',matchingDeals[0].id),nodeId,'deal-transaction','exact deal/contact match');linkedToCrm=true;}
    }
   }
   return {id:nodeId,transactionKey:id,date:tx.date||tx.transaction_date||null,amount:Number(tx.amount||0),currency:String(tx.currency||'').toUpperCase()||'UNSPECIFIED',basis,category:tx.category||tx.categoryName||'Needs review',counterparty:tx.counterparty||tx.counterparty_name||null,label,linkedToCrm};
  });
  const uniqueEdges=[...new Map(edges.map(e=>[e.id,e])).values()];
  const financeSummary=summarizeFinance(transactions);
  const summary={contacts:contacts.length,deals:deals.length,tasks:tasks.length,channels:channels.length,findings:findings.length,transactions:transactions.length,messages30d:Number(chatSummary[0]?.messages_30d||0),messagesTotal:Number(chatSummary[0]?.messages||0),matchedTransactions:financeNodes.filter(tx=>tx.linkedToCrm).length};
  return send(res,200,{generatedAt:new Date().toISOString(),scope:'workspace-only',summary,nodes,edges:uniqueEdges,transactions:financeNodes,unlinkedTransactions:financeNodes.filter(tx=>!tx.linkedToCrm).slice(0,50),financialSummary:financeSummary,limits:{contacts:150,deals:150,tasks:150,channels:100,findings:100,transactions:500},notes:['CRM, tasks, channels and financial transactions are scoped to the same authenticated Data Center workspace.','Transactions link automatically only on an exact, unique normalized CRM name/company match. Ambiguous/unmatched records can be linked manually and the confirmed link is persisted in dc_transaction_matches.','Cash-basis and accrual-basis totals remain separate; mixed currencies are not added together.','Chat message bodies are not returned; only activity counts are included.']});
 }catch(error){console.error('Universe graph failed:',error);return send(res,500,{error:'Could not build the workspace business graph'});}
}
