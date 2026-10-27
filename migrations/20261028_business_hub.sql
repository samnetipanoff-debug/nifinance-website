-- Additive Business Hub schema. Not auto-applied; API also ensures compatible tables.
CREATE TABLE IF NOT EXISTS public.bh_contacts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 kind TEXT NOT NULL DEFAULT 'lead' CHECK (kind IN ('lead','customer','supplier','partner')), name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT,
 source TEXT, status TEXT NOT NULL DEFAULT 'new', owner_label TEXT, notes TEXT, custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bh_contacts_workspace_idx ON public.bh_contacts(workspace_id,kind,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.bh_deals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 contact_id UUID REFERENCES public.bh_contacts(id) ON DELETE SET NULL, title TEXT NOT NULL,
 stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','discovery','proposal','negotiation','won','lost')),
 amount NUMERIC(20,4), currency CHAR(3), probability NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
 expected_close_date DATE, owner_label TEXT, next_step TEXT, lost_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bh_deals_workspace_idx ON public.bh_deals(workspace_id,stage,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.bh_activities (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 contact_id UUID REFERENCES public.bh_contacts(id) ON DELETE SET NULL, deal_id UUID REFERENCES public.bh_deals(id) ON DELETE SET NULL,
 activity_type TEXT NOT NULL CHECK (activity_type IN ('note','call','email','meeting','stage_change','system')), summary TEXT NOT NULL,
 details JSONB NOT NULL DEFAULT '{}'::jsonb, actor_label TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bh_chat_channels (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 channel_type TEXT NOT NULL DEFAULT 'team' CHECK (channel_type IN ('team','project','deal','direct')), name TEXT NOT NULL, topic TEXT,
 linked_object_type TEXT, linked_object_id TEXT, created_by_label TEXT, archived_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.bh_chat_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 channel_id UUID NOT NULL REFERENCES public.bh_chat_channels(id) ON DELETE CASCADE, sender_label TEXT NOT NULL,
 body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000), message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','system','ai_summary')),
 reply_to_id UUID REFERENCES public.bh_chat_messages(id) ON DELETE SET NULL, linked_object_type TEXT, linked_object_id TEXT,
 edited_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bh_messages_timeline_idx ON public.bh_chat_messages(workspace_id,channel_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.bh_tasks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
 priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')), owner_label TEXT, created_by_label TEXT, due_at TIMESTAMPTZ,
 linked_object_type TEXT, linked_object_id TEXT, source_finding_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bh_tasks_board_idx ON public.bh_tasks(workspace_id,status,priority,due_at);
CREATE TABLE IF NOT EXISTS public.bh_core_findings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES public.dc_workspaces(workspace_id) ON DELETE CASCADE,
 finding_type TEXT NOT NULL CHECK (finding_type IN ('alert','pattern','hypothesis','recommendation','simulation')), title TEXT NOT NULL, summary TEXT NOT NULL,
 severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')), confidence NUMERIC(5,4),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed','in_progress','completed')),
 evidence JSONB NOT NULL DEFAULT '[]'::jsonb, assumptions JSONB NOT NULL DEFAULT '[]'::jsonb, proposed_action JSONB NOT NULL DEFAULT '{}'::jsonb,
 model_provider TEXT, model_version TEXT, prompt_version TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bh_findings_inbox_idx ON public.bh_core_findings(workspace_id,status,severity,created_at DESC);
