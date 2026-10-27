# Multi-tenant business core and Universe registry

## Product boundary

- **Data Center** is the source of truth for imported records, master data, classification, provenance and entity relationships.
- **Universe** is the shared visual workspace. Finance reports, CRM, user workspaces, communication and company pulse are modules rendered inside Universe, not separate products with duplicate data models.
- **Organization (tenant)** is the security boundary. A platform may host many organizations and each organization may have many users and roles. All reads and writes must be scoped to an authorized organization and workspace.
- Existing typed tables remain authoritative for each domain. `dc_business_objects` provides stable cross-module identities; `dc_business_links` provides explicit relationships between those identities.

## Core relationships

```text
Organization
  ├── Workspaces
  ├── Memberships ── Users
  │       └── Roles ── Permissions
  ├── Business objects
  │       ├── transaction
  │       ├── counterparty
  │       ├── budget_category
  │       ├── department / project
  │       ├── CRM lead / deal / customer
  │       ├── document / task / conversation
  │       └── Universe node
  └── Business links
          ├── transaction -> counterparty
          ├── transaction -> budget_category
          ├── transaction -> department / project
          ├── CRM deal -> customer
          ├── CRM deal -> originating lead
          └── report metric -> source objects
```

## Important design rules

1. A transaction links to stable IDs, not only category or counterparty display strings. Names are labels, not keys.
2. A budget category is distinct from a financial-report mapping, a cash-flow classification, and a statutory/tax treatment. One operation may have different mappings for different report views.
3. Links can be suggested, confirmed or rejected; AI is allowed to suggest links, never silently confirm low-confidence matches.
4. Every link is tenant/workspace scoped. Database foreign keys prevent links across workspaces. API authorization must also check the user's active membership and permissions.
5. A user may belong to multiple organizations. Their role and data scope are membership-specific, not global.
6. Access is enforced on the server for every request. Hiding UI controls is not authorization. Use deny-by-default permissions and audit changes to access grants.
7. The current browser workspace token is prototype access, not employee authentication. The API now shares one verifier that validates UUID/token shape and compares SHA-256 token hashes with a constant-time comparison. This hardens the existing prototype credential check, but it does not replace verified user identity, active organization membership, role/permission checks, session expiry/revocation, or audit of user actions. Do not treat this as production-ready authentication.
8. Do not apply the migration until the API has been updated to create an organization with each new workspace and all endpoints enforce tenant/membership scope. Migration is additive and backfills existing workspaces to preserve current data.
9. Do not store passwords in `dc_users`; connect a verified identity provider and persist its provider + subject. Invitation acceptance must verify identity.
10. Universe visualization is a view over these entities and links; it must not become a second database.

## Suggested implementation order

1. Apply migration only alongside compatible API changes.
2. Update workspace creation to create an organization and seed owner membership/roles atomically; add verified authentication and authorization middleware.
3. Backfill current transactions, counterparties and categories into the business-object registry and create confirmed links for existing explicit IDs; keep uncertain matches suggested.
4. Add organization/workspace scoping tests, including cross-tenant negative tests.
5. Implement the financial calculation layer over normalized transactions and explicit report mappings.
6. Render reports and drill-down panels inside Universe.
7. Add CRM entities and pipelines using the same registry and link table.
8. Add employee workspaces, tasks, communication and role-specific Company Pulse views.

## Migration status

The SQL in `migrations/20261022_multi_tenant_business_core.sql` is a reviewed starting point only. It is not executed by the app or against Neon as part of this pull request. API integration, tenant authorization, auth-provider setup and migration tests are still required before enabling multi-company production use.
