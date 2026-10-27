import { neon } from '@neondatabase/serverless';
import { isWorkspaceId, isWorkspaceToken, workspaceTokenMatches } from './_lib/workspace-auth.js';

const send=(res,status,body)=>res.status(status).json(body);
const clean=(v,n=180)=>String(v??'').slice(0,n);
const objectKey=(type,id)=>type&&id?`${String(type).toLowerCase()}:${String(id)}`:null;

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{error:'Method not allowed'});}
 if(!process.env.DATABASE_URL)return send(res,503,{error:'Database connection is not configured'});
 const workspaceId=req.headers['x-workspace-id'],token=req.headers['x-workspace-token'];
 if(!isWorkspaceId(workspaceId)||!isWorkspaceToken(token))return send(res,401,{error:'A valid workspace credential is required'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  const w=await sql`SELECT token_hash FROM public.dc_workspaces WHERE workspace_id=${workspaceId}::uuid LIMIT 1`;
  if(!w[0]||!workspaceTokenMatches(w[0].token_hash,token))return send(res,401,{error:'Workspace credential was not accepted'});
  const [contacts,deals,tasks,channels,findings,chatSummary]=await Promise.all([
   sql`SELECT id,name,kind,status FROM public.bh_contacts WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 150`,
   sql`SELECT id,title,stage,amount,currency,contact_id FROM public.bh_deals WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 150`,
   sql`SELECT id,title,status,priority,linked_object_type,linked_object_id FROM public.bh_tasks WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 150`,
   sql`SELECT id,name,channel_type,linked_object_type,linked_object_id FROM public.bh_chat_channels WHERE workspace_id=${workspaceId}::uuid AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
   sql`SELECT id,title,finding_type,severity,status FROM public.bh_core_findings WHERE workspace_id=${workspaceId}::uuid ORDER BY created_at DESC LIMIT 100`,
   sql`SELECT COUNT(DISTINCT c.id)::int AS channels,COUNT(m.id)::int AS messages,COUNT(m.id) FILTER(WHERE m.created_at>NOW()-INTERVAL '30 days')::int AS messages_30d FROM public.bh_chat_channels c LEFT JOIN public.bh_chat_messages m ON m.channel_id=c.id AND m.workspace_id=c.workspace_id AND m.deleted_at IS NULL WHERE c.workspace_id=${workspaceId}::uuid AND c.archived_at IS NULL`
  ]);
  const nodes=[],edges=[],seen=new Set();
  const add=(type,id,label,meta={})=>{if(!id)return;const key=objectKey(type,id);if(seen.has(key))return;seen.add(key);nodes.push({id:key,type,label:clean(label),meta});};
  const edge=(from,to,kind,label)=>{if(!from||!to||from===to)return;edges.push({id:`${kind}:${from}:${to}`,from,to,kind,label:clean(label,80)});};
  contacts.forEach(c=>add('contact',c.id,c.name,{kind:c.kind,status:c.status}));
  deals.forEach(d=>{add('deal',d.id,d.title,{stage:d.stage,amount:d.amount==null?null:Number(d.amount),currency:d.currency?.trim()||null});if(d.contact_id)edge(objectKey('contact',d.contact_id),objectKey('deal',d.id),'contact-deal','owns / associated with');});
  tasks.forEach(t=>{add('task',t.id,t.title,{status:t.status,priority:t.priority});const target=objectKey(t.linked_object_type,t.linked_object_id);if(target&&seen.has(target))edge(target,objectKey('task',t.id),'linked-task','has task');});
  channels.forEach(c=>{add('channel',c.id,c.name,{channelType:c.channel_type});const target=objectKey(c.linked_object_type,c.linked_object_id);if(target&&seen.has(target))edge(target,objectKey('channel',c.id),'linked-channel','discussed in');});
  findings.forEach(f=>{add('finding',f.id,f.title,{findingType:f.finding_type,severity:f.severity,status:f.status});});
  const summary={contacts:contacts.length,deals:deals.length,tasks:tasks.length,channels:channels.length,findings:findings.length,messages30d:Number(chatSummary[0]?.messages_30d||0),messagesTotal:Number(chatSummary[0]?.messages||0)};
  return send(res,200,{generatedAt:new Date().toISOString(),scope:'workspace-only',summary,nodes,edges,limits:{contacts:150,deals:150,tasks:150,channels:100,findings:100},notes:['Only records belonging to the authenticated workspace are included.','Chat message bodies are not returned; only activity counts are included.','Financial Data Center records are not yet linked to this workspace graph; no cross-workspace financial data is mixed into this graph.']});
 }catch(error){console.error('Universe graph failed:',error);return send(res,500,{error:'Could not build the workspace business graph'});}
}
