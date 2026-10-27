# Business Hub: CRM, internal chat, tasks and Universe Core

Business Hub is the operational layer of NIFINANCE Business Universe, not a set of disconnected mini-apps. CRM records, messages, tasks, financial source records and Core findings should cross-link through stable object references and later through the shared business-object registry.

## Implemented foundation
- Workspace-scoped CRM contacts/leads and deals using a consistent sales pipeline: lead → qualified → discovery → proposal → negotiation → won/lost.
- CRM activity timeline for notes, calls, emails, meetings and stage changes.
- Internal channels for team/project/deal contexts; messages may link to a business object.
- Tasks with priority, owner label, due date, status and optional linked object.
- Workspace-scoped normalized business graph (`/api/universe-graph`) for contacts, deals, tasks, channels and findings, with typed edges and aggregate-only chat activity.
- Universe Core findings schema with evidence, assumptions, confidence, status and model provenance; Core briefing now includes aggregate communication counts and linked-task counts.
- Additive SQL migration and API; the existing workspace credential remains temporarily in use.

## Important prototype boundary
`sender_label` and `owner_label` are display labels, not verified employee identities. They are not permissions or audit-grade identity. Authorization and verified employee identity are intentionally deferred. Do not enable real multi-company access until membership and server-side role checks are implemented.

## Intended interactions
1. Deal moves to negotiation → CRM activity is logged and a task can be assigned for the next step.
2. Core detects a decline in qualified leads → finding links to evidence and can create a task for marketing.
3. Customer page should aggregate deal history, linked channel references, tasks and relevant financial transactions.
4. The in-sphere navigator renders child records as connected branch nodes, with breadcrumbs and deeper drilldown rather than detached floating windows.
4. Chat references a deal/task/contact instead of duplicating business context.

## Current cross-domain boundary
The graph deliberately does not combine the global Northstar demo finance tables with a workspace's CRM records. Financial Data Center analytics need an explicit company/workspace mapping and tenant-scoped source identifiers before they can safely become edges in this graph. Until then, financial metrics remain in the separate demo sphere and Core reports the missing mapping as a data gap.

## AI boundaries
Use deterministic SQL/code for money, pipeline totals, permissions, validation and state transitions. Use AI for summarization, drafting, classification proposals and explanations. Store evidence references and model/prompt versions with findings. Recommendations are proposals, not executed actions; external communication, financial actions, destructive changes and material decisions require explicit approval. Scope workspace data before building model context.

## Next sequence
1. Complete a tenant-safe company/workspace mapping between Data Center financial analytics and the normalized business graph.
2. Add stable shared-object references for financial source records, CRM entities, tasks, channels and findings.
3. Persist Core findings with evidence references and approval/outcome history rather than only returning a transient briefing.
4. Later: verified employee identity, organization membership and server-side roles.

The migration `migrations/20261028_business_hub.sql` is additive and not auto-applied. The API ensures compatible tables on demand for the current prototype.
