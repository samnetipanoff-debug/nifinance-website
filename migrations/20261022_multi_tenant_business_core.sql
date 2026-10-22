-- NIFINANCE Data Center: multi-tenant business core
-- This migration is intentionally additive. It is NOT auto-applied by the app.
-- Review and apply only after the API is updated to create organizations and enforce membership checks.

CREATE TABLE IF NOT EXISTS public.dc_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country_code CHAR(2),
  default_currency CHAR(3),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A workspace remains the current Data Center storage boundary.
-- Organizations are the tenant boundary; one organization may later have multiple workspaces.
ALTER TABLE public.dc_workspaces
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.dc_organizations(id) ON DELETE RESTRICT;

-- Preserve existing workspaces by assigning each one a migration organization.
-- The organization name/slug can be edited later by an authorized owner.
INSERT INTO public.dc_organizations (name, slug)
SELECT
  'Migrated workspace ' || LEFT(w.workspace_id::text, 8),
  'migrated-' || REPLACE(w.workspace_id::text, '-', '')
FROM public.dc_workspaces w
WHERE w.organization_id IS NULL
ON CONFLICT (slug) DO NOTHING;

UPDATE public.dc_workspaces w
SET organization_id = o.id,
    updated_at = NOW()
FROM public.dc_organizations o
WHERE w.organization_id IS NULL
  AND o.slug = 'migrated-' || REPLACE(w.workspace_id::text, '-', '');

ALTER TABLE public.dc_workspaces ALTER COLUMN organization_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dc_workspaces_id_org_uidx
  ON public.dc_workspaces (workspace_id, organization_id);
CREATE INDEX IF NOT EXISTS dc_workspaces_organization_idx
  ON public.dc_workspaces (organization_id);

-- App users are linked to a verified identity from the eventual auth provider.
-- Do not store passwords or treat an email address alone as proof of identity.
CREATE TABLE IF NOT EXISTS public.dc_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended','deactivated')),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (auth_provider, auth_subject)
);
CREATE UNIQUE INDEX IF NOT EXISTS dc_users_email_lower_idx
  ON public.dc_users (LOWER(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dc_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.dc_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.dc_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','removed')),
  job_title TEXT,
  department_id UUID,
  invited_by UUID REFERENCES public.dc_users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS dc_memberships_user_idx ON public.dc_memberships (user_id, status);

-- Roles are organization-scoped so a company can customize its own role set.
CREATE TABLE IF NOT EXISTS public.dc_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.dc_organizations(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, role_key),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.dc_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dc_role_permissions (
  role_id UUID NOT NULL REFERENCES public.dc_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.dc_permissions(id) ON DELETE CASCADE,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.dc_membership_roles (
  membership_id UUID NOT NULL REFERENCES public.dc_memberships(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.dc_roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.dc_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membership_id, role_id)
);

-- Registry of business entities. Typed module tables remain authoritative; this registry
-- supplies stable cross-module identities for Universe navigation and search.
CREATE TABLE IF NOT EXISTS public.dc_business_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.dc_organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  search_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, object_type, object_id),
  UNIQUE (id, workspace_id, organization_id),
  FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.dc_workspaces(workspace_id, organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS dc_business_objects_org_type_idx
  ON public.dc_business_objects (organization_id, object_type, status);
CREATE INDEX IF NOT EXISTS dc_business_objects_search_idx
  ON public.dc_business_objects USING GIN (to_tsvector('simple', display_name || ' ' || search_text));

-- Typed, auditable links connect transactions, counterparties, budget categories,
-- departments, projects, CRM leads/deals, documents, users and Universe nodes.
CREATE TABLE IF NOT EXISTS public.dc_business_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.dc_organizations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  source_object_id UUID NOT NULL,
  target_object_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('suggested','confirmed','rejected')),
  confidence NUMERIC(5,4),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','rule','import','ai','system')),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.dc_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_object_id <> target_object_id),
  FOREIGN KEY (workspace_id, organization_id)
    REFERENCES public.dc_workspaces(workspace_id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (source_object_id, workspace_id, organization_id)
    REFERENCES public.dc_business_objects(id, workspace_id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (target_object_id, workspace_id, organization_id)
    REFERENCES public.dc_business_objects(id, workspace_id, organization_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, source_object_id, target_object_id, relation_type)
);
CREATE INDEX IF NOT EXISTS dc_business_links_source_idx
  ON public.dc_business_links (workspace_id, source_object_id, relation_type);
CREATE INDEX IF NOT EXISTS dc_business_links_target_idx
  ON public.dc_business_links (workspace_id, target_object_id, relation_type);

-- Minimum permission catalog; feature-specific permissions can be added incrementally.
INSERT INTO public.dc_permissions (permission_key, module, action, description) VALUES
  ('company.view', 'company', 'view', 'View company workspace and profile'),
  ('company.manage', 'company', 'manage', 'Manage company settings'),
  ('users.view', 'users', 'view', 'View company users'),
  ('users.manage', 'users', 'manage', 'Invite users and manage memberships'),
  ('roles.manage', 'access', 'manage', 'Manage roles and permissions'),
  ('data.view', 'data-center', 'view', 'View imported data and directories'),
  ('data.import', 'data-center', 'import', 'Import source files'),
  ('data.edit', 'data-center', 'edit', 'Edit classifications and business links'),
  ('data.export', 'data-center', 'export', 'Export company data'),
  ('finance.view', 'finance', 'view', 'View financial reports'),
  ('finance.manage', 'finance', 'manage', 'Manage financial mappings and budgets'),
  ('crm.view', 'crm', 'view', 'View CRM records'),
  ('crm.manage', 'crm', 'manage', 'Manage leads, deals and pipelines'),
  ('tasks.view', 'work', 'view', 'View assigned tasks and work items'),
  ('tasks.manage', 'work', 'manage', 'Create and manage work items'),
  ('communication.view', 'communication', 'view', 'View permitted conversations'),
  ('communication.send', 'communication', 'send', 'Send messages in permitted conversations'),
  ('audit.view', 'audit', 'view', 'View audit events')
ON CONFLICT (permission_key) DO NOTHING;
