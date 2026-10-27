import { neon } from '@neondatabase/serverless';
import { isWorkspaceId, isWorkspaceToken, workspaceTokenMatches } from './_lib/workspace-auth.js';
const send=(res,status,body)=>res.status(status).json(body);
const str=(v,n=500)=>String(v??'').trim().slice(0,n);
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
async function schema(sql){
 await sql`CREATE TABLE IF NOT EXISTS public.bh_contacts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,kind TEXT NOT NULL DEFAULT 'lead',name TEXT NOT NULL,company TEXT,email TEXT,phone TEXT,source TEXT,status TEXT NOT NULL DEFAULT 'new',owner_label TEXT,notes TEXT,custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_deals(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,contact_id UUID REFERENCES public.bh_contacts(id) ON DELETE SET NULL,title TEXT NOT NULL,stage TEXT NOT NULL DEFAULT 'lead',amount NUMERIC(20,4),currency CHAR(3),probability NUMERIC(5,2) NOT NULL DEFAULT 0,expected_close_date DATE,owner_label TEXT,next_step TEXT,lost_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_activities(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,contact_id UUID REFERENCES public.bh_contacts(id) ON DELETE SET NULL,deal_id UUID REFERENCES public.bh_deals(id) ON DELETE SET NULL,activity_type TEXT NOT NULL,summary TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}'::jsonb,actor_label TEXT,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_chat_channels(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,channel_type TEXT NOT NULL DEFAULT 'team',name TEXT NOT NULL,topic TEXT,linked_object_type TEXT,linked_object_id TEXT,created_by_label TEXT,archived_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_chat_messages(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,channel_id UUID NOT NULL REFERENCES public.bh_chat_channels(id) ON DELETE CASCADE,sender_label TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),message_type TEXT NOT NULL DEFAULT 'text',reply_to_id UUID REFERENCES public.bh_chat_messages(id) ON DELETE SET NULL,linked_object_type TEXT,linked_object_id TEXT,edited_at TIMESTAMPTZ,deleted_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_tasks(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT,status TEXT NOT NULL DEFAULT 'open',priority TEXT NOT NULL DEFAULT 'normal',owner_label TEXT,created_by_label TEXT,due_at TIMESTAMPTZ,linked_object_type TEXT,linked_object_id TEXT,source_finding_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS public.bh_core_findings(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,finding_type TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'info',confidence NUMERIC(5,4),status TEXT NOT NULL DEFAULT 'open',evidence JSONB NOT NULL DEFAULT '[]'::jsonb,assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,proposed_action JSONB NOT NULL DEFAULT '{}'::jsonb,model_provider TEXT,model_version TEXT,prompt_version TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE INDEX IF NOT EXISTS bh_messages_timeline_idx ON public.bh_chat_messages(workspace_id,channel_id,created_at DESC)`;
 await sql`CREATE INDEX IF NOT EXISTS bh_tasks_board_idx ON public.bh_tasks(workspace_id,status,priority,due_at)`;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!process.env.DATABASE_URL)return send(res,503,{error:'Database connection is not configured',code:'DATABASE_NOT_CONFIGURED'});
 if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return send(res,405,{error:'Method not allowed'});}
 const workspaceId=req.headers['x-workspace-id'],token=req.headers['x-workspace-token'];
 if(!isWorkspaceId(workspaceId)||!isWorkspaceToken(token))return send(res,401,{error:'A valid workspace credential is required',code:'INVALID_CREDENTIALS'});
 try{
  const sql=neon(process.env.DATABASE_URL);await schema(sql);
  const w=await sql`SELECT token_hash FROM public.dc_workspaces WHERE workspace_id=${workspaceId}::uuid LIMIT 1`;
  if(!w[0]||!workspaceTokenMatches(w[0].token_hash,token))return send(res,401,{error:'Workspace credential was not accepted',code:'INVALID_CREDENTIALS'});
  if(req.method==='GET'&&str(req.query?.action)==='messages'){
   const cid=req.query?.channelId;if(!uuid(cid))return send(res,400,{error:'A valid channelId is required'});
   const c=await sql`SELECT id FROM public.bh_chat_channels WHERE id=${cid}::uuid AND workspace_id=${workspaceId}::uuid AND archived_at IS NULL`;
   if(!c.length)return send(res,404,{error:'Channel not found'});
   const messages=await sql`SELECT * FROM public.bh_chat_messages WHERE workspace_id=${workspaceId}::uuid AND channel_id=${cid}::uuid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`;
   return send(res,200,{messages:messages.reverse()});
  }
  if(req.method==='GET'){
   const [contacts,deals,channels,tasks,findings]=await Promise.all([
    sql`SELECT * FROM public.bh_contacts WHERE workspace_id=${workspaceId}::uuid ORDER BY updated_at DESC LIMIT 500`,
    sql`SELECT d.*,c.name AS contact_name FROM public.bh_deals d LEFT JOIN public.bh_contacts c ON c.id=d.contact_id AND c.workspace_id=d.workspace_id WHERE d.workspace_id=${workspaceId}::uuid ORDER BY d.updated_at DESC LIMIT 500`,
    sql`SELECT * FROM public.bh_chat_channels WHERE workspace_id=${workspaceId}::uuid AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 200`,
    sql`SELECT * FROM public.bh_tasks WHERE workspace_id=${workspaceId}::uuid ORDER BY due_at NULLS LAST LIMIT 500`,
    sql`SELECT * FROM public.bh_core_findings WHERE workspace_id=${workspaceId}::uuid AND status='open' ORDER BY created_at DESC LIMIT 100`
   ]);return send(res,200,{contacts,deals,channels,tasks,findings});
  }
  const b=req.body||{},a=str(b.action,60);
  if(req.method==='POST'&&a==='contact.create'){
   const name=str(b.name,200);if(!name)return send(res,400,{error:'Contact name is required'});
   const kind=['lead','customer','supplier','partner'].includes(b.kind)?b.kind:'lead';
   const r=await sql`INSERT INTO public.bh_contacts(workspace_id,kind,name,company,email,phone,source,status,owner_label,notes) VALUES(${workspaceId}::uuid,${kind},${name},${str(b.company,200)||null},${str(b.email,254)||null},${str(b.phone,80)||null},${str(b.source,120)||null},${str(b.status,60)||'new'},${str(b.ownerLabel,120)||null},${str(b.notes,4000)||null}) RETURNING *`;return send(res,201,{contact:r[0]});
  }
  if(req.method==='POST'&&a==='deal.create'){
   const title=str(b.title,250);if(!title)return send(res,400,{error:'Deal title is required'});const cid=uuid(b.contactId)?b.contactId:null;
   if(cid){const c=await sql`SELECT id FROM public.bh_contacts WHERE id=${cid}::uuid AND workspace_id=${workspaceId}::uuid`;if(!c.length)return send(res,400,{error:'Contact does not belong to this workspace'});}
   const stage=['lead','qualified','discovery','proposal','negotiation','won','lost'].includes(b.stage)?b.stage:'lead';
   const r=await sql`INSERT INTO public.bh_deals(workspace_id,contact_id,title,stage,amount,currency,probability,expected_close_date,owner_label,next_step) VALUES(${workspaceId}::uuid,${cid}::uuid,${title},${stage},${b.amount!==''&&Number.isFinite(Number(b.amount))?Number(b.amount):null},${str(b.currency,3).toUpperCase()||null},${Math.min(100,Math.max(0,Number(b.probability)||0))},${/^\d{4}-\d{2}-\d{2}$/.test(String(b.expectedCloseDate||''))?b.expectedCloseDate:null},${str(b.ownerLabel,120)||null},${str(b.nextStep,500)||null}) RETURNING *`;return send(res,201,{deal:r[0]});
  }
  if(req.method==='POST'&&a==='channel.create'){
   const name=str(b.name,120);if(!name)return send(res,400,{error:'Channel name is required'});const type=['team','project','deal','direct'].includes(b.channelType)?b.channelType:'team';
   const r=await sql`INSERT INTO public.bh_chat_channels(workspace_id,channel_type,name,topic,linked_object_type,linked_object_id,created_by_label) VALUES(${workspaceId}::uuid,${type},${name},${str(b.topic,500)||null},${str(b.linkedObjectType,80)||null},${str(b.linkedObjectId,100)||null},${str(b.createdByLabel,120)||'Workspace member'}) RETURNING *`;return send(res,201,{channel:r[0]});
  }
  if(req.method==='POST'&&a==='message.send'){
   const cid=b.channelId,msg=str(b.body,10000);if(!uuid(cid)||!msg)return send(res,400,{error:'A valid channelId and message are required'});
   const c=await sql`SELECT id FROM public.bh_chat_channels WHERE id=${cid}::uuid AND workspace_id=${workspaceId}::uuid AND archived_at IS NULL`;if(!c.length)return send(res,404,{error:'Channel not found'});
   const r=await sql`INSERT INTO public.bh_chat_messages(workspace_id,channel_id,sender_label,body,linked_object_type,linked_object_id) VALUES(${workspaceId}::uuid,${cid}::uuid,${str(b.senderLabel,120)||'Workspace member'},${msg},${str(b.linkedObjectType,80)||null},${str(b.linkedObjectId,100)||null}) RETURNING *`;
   await sql`UPDATE public.bh_chat_channels SET updated_at=NOW() WHERE id=${cid}::uuid AND workspace_id=${workspaceId}::uuid`;return send(res,201,{message:r[0]});
  }
  if(req.method==='POST'&&a==='task.create'){
   const title=str(b.title,250);if(!title)return send(res,400,{error:'Task title is required'});const priority=['low','normal','high','urgent'].includes(b.priority)?b.priority:'normal';
   const due= b.dueAt && Number.isFinite(Date.parse(b.dueAt)) ? new Date(b.dueAt).toISOString() : null;
   const r=await sql`INSERT INTO public.bh_tasks(workspace_id,title,description,priority,owner_label,created_by_label,due_at,linked_object_type,linked_object_id) VALUES(${workspaceId}::uuid,${title},${str(b.description,4000)||null},${priority},${str(b.ownerLabel,120)||null},${str(b.createdByLabel,120)||'Workspace member'},${due},${str(b.linkedObjectType,80)||null},${str(b.linkedObjectId,100)||null}) RETURNING *`;return send(res,201,{task:r[0]});
  }
  if(req.method==='PATCH'&&a==='task.update'){
   if(!uuid(b.taskId))return send(res,400,{error:'A valid taskId is required'});const status=['open','in_progress','blocked','done','cancelled'].includes(b.status)?b.status:'open';
   const r=await sql`UPDATE public.bh_tasks SET status=${status},priority=${['low','normal','high','urgent'].includes(b.priority)?b.priority:'normal'},owner_label=${str(b.ownerLabel,120)||null},updated_at=NOW() WHERE id=${b.taskId}::uuid AND workspace_id=${workspaceId}::uuid RETURNING *`;return r.length?send(res,200,{task:r[0]}):send(res,404,{error:'Task not found'});
  }
  if(req.method==='POST'&&a==='activity.create'){
   const summary=str(b.summary,1000);if(!summary)return send(res,400,{error:'Activity summary is required'});const cid=uuid(b.contactId)?b.contactId:null,did=uuid(b.dealId)?b.dealId:null;
   const type=['note','call','email','meeting','stage_change','system'].includes(b.activityType)?b.activityType:'note';
   const r=await sql`INSERT INTO public.bh_activities(workspace_id,contact_id,deal_id,activity_type,summary,details,actor_label) VALUES(${workspaceId}::uuid,${cid}::uuid,${did}::uuid,${type},${summary},${JSON.stringify(b.details||{})}::jsonb,${str(b.actorLabel,120)||null}) RETURNING *`;return send(res,201,{activity:r[0]});
  }
  return send(res,400,{error:'Unsupported Business Hub action',supported:['contact.create','deal.create','channel.create','messages (GET query)','message.send','task.create','task.update','activity.create']});
 }catch(error){console.error('Business Hub request failed:',error);return send(res,500,{error:'Could not process Business Hub request'});}
}
