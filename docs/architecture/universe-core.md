# Universe Core — central intelligence architecture

## Product definition

Universe Core is the shared intelligence and orchestration layer of the Universe platform. It is inspired by the *role* of a JARVIS-like assistant: it observes authorized business data, builds a connected picture of the company, explains changes, forecasts outcomes, and proposes actions. It is not an omniscient agent and must not make unreviewed consequential changes.

The product has three distinct layers:

1. **Data Center — source of truth.** Imported and manually entered source records, mappings, reference directories, provenance, validation, and corrections live here.
2. **Universe Core — analysis and decision engine.** Normalizes events, connects entities, calculates metrics, detects deviations, builds explainable hypotheses, runs scenarios, and creates recommendations.
3. **Universe — the operating environment.** The Core is visualized as the living center of the sphere/world; people explore insights and workspaces in the same environment instead of navigating a disconnected set of apps.

## Core capabilities

### 1. Connected business model
- Resolve stable identities for organizations, workspaces, users, counterparties, departments, projects, products, campaigns, CRM leads/deals, tasks, and source documents.
- Keep typed domain tables authoritative; use the shared business-object registry and explicit links to connect modules.
- Store source lineage for every derived metric and recommendation: source file/row or record IDs, transformation/rule/model version, and calculation timestamp.
- Never merge records only because their names look similar. Use confidence-scored matching and human review for ambiguous identity resolution.

### 2. Analytical engine
- Compute management P&L, cash flow, and balance only when their required source data and assumptions are available.
- Keep cash-basis and accrual-basis views distinct. Bank statement records are cash basis; accounting journals can be accrual basis. Do not silently combine or double-count the same economic event.
- Treat loan principal as financing, not operating revenue or expense; show interest separately.
- Show department, budget category, project, customer, channel, and time-period cuts where supported by data.
- Every KPI should disclose period, basis, currency, freshness, completeness, and drill-down to source records.
- If inputs are incomplete, label a result as provisional/estimated and state what is missing. Never fabricate an opening balance or claim a complete balance sheet from a bank statement alone.

### 3. Causal and dependency graph
- Represent relationships such as campaign spend → qualified leads → opportunities → sales; supplier prices → cost of delivery → gross margin; staffing → capacity → delivery time.
- Distinguish observed facts, computed dependencies, statistical associations, and AI-generated hypotheses.
- Do not claim causality from correlation alone. Recommendations should state evidence, assumptions, confidence, expected impact range, and what would disprove the hypothesis.

### 4. Monitoring and recommendations
- Detect changes against prior periods, budgets, targets, forecasts, and expected ranges.
- Prioritize findings by business impact, urgency, confidence, and reversibility.
- Each recommendation includes: what changed, likely drivers, supporting evidence, expected result/range, risk/trade-offs, proposed next action, owner, and approval state.
- Support “why did this happen?”, “what changed?”, “what if we…?”, “what should we do next?” and drill-down into source evidence.
- Scenario results must be labeled as simulations, with assumptions visible and editable.

### 5. Action orchestration
- The Core may draft tasks, messages, budget changes, CRM follow-ups, and scenario plans.
- Read-only analysis can run automatically within the user's permissions.
- Any external communication, financial transaction, destructive change, permission change, or material business decision requires explicit authorized approval before execution.
- Log recommendation creation, edits, approvals, execution, failures, and resulting outcomes in an audit trail.

## Experience inside Universe

- The Core should feel like a central living intelligence in the Universe visual language, not a separate admin dashboard.
- The central core can display system pulse: data freshness, alerts, business health, and active analyses.
- Surrounding business nodes and links visualize only meaningful, permission-filtered relationships. Links should lead to evidence and remain attached to their entities.
- Selecting a finding opens its explanation and evidence in an in-world detail window. Multiple findings/windows can remain open without obscuring key labels.
- Provide a conversational entry point for questions, but responses must link back to measurable KPIs, source records, assumptions, and actions.
- Keep the immersive rendering as a presentation layer. Business logic, calculations, permissions, and decisions belong to server-side APIs/services, not browser-only logic.

## Multi-company security and permissions

- Organization is the tenant/security boundary; a user may belong to multiple organizations and hold different roles in each.
- The Core can analyze only records belonging to the active organization and the user's authorized scope.
- Enforce membership and permissions on every server-side query and mutation. Hiding a UI control is not access control.
- Recommendations inherit the visibility rules of their evidence; never reveal restricted data through summaries, graph edges, counts, or model prompts.
- Do not send cross-tenant data to an AI provider. Apply tenant scoping before retrieval/context construction, and record model/provider and prompt-template versions without logging secrets.
- The existing browser workspace token is a prototype mechanism, not production authentication.

## AI design principles

Use deterministic code/SQL for financial arithmetic, permissions, data validation, and reproducible calculations. Use models for classification suggestions, summarization, entity resolution proposals, anomaly explanations, and scenario narratives where appropriate. Validate model outputs against schemas and source evidence.

Every AI result must include provenance and a status such as:
- **Fact** — directly present in a source.
- **Calculated** — reproducible formula over known inputs.
- **Detected pattern** — statistically observed, not necessarily causal.
- **Hypothesis** — plausible explanation requiring validation.
- **Recommendation** — proposed action, not yet executed.
- **Simulation** — forecast under stated assumptions.

## Suggested service boundaries

- **Ingestion & validation:** file imports, schema recognition, deduplication, source-basis metadata.
- **Identity & business graph:** entity resolution, shared object registry, typed relationships.
- **Metrics engine:** reproducible KPI definitions, financial statements, budget/actuals.
- **Signal engine:** thresholds, anomaly detection, trend changes, data quality signals.
- **Reasoning service:** evidence retrieval, explanation generation, hypothesis ranking, scenario narration.
- **Recommendation & action service:** recommendation lifecycle, approvals, task/message drafts, execution connectors.
- **Audit & evaluation:** immutable event trail, model/rule versions, feedback, outcome tracking.

These are logical boundaries first; do not split into microservices prematurely. Start with well-separated modules in the existing application and API.

## Implementation order

1. Confirm the multi-tenant data model and secure organization-scoped API/authentication.
2. Establish canonical source records, basis metadata, identity registry, and lineage.
3. Build deterministic KPI definitions and data-quality/completeness checks.
4. Add business graph links and source drill-down.
5. Add monitored signals and explainable recommendations in read-only mode.
6. Add scenario simulation and user feedback/evaluation.
7. Add approval-gated actions and integrations.
8. Visualize the Core in Universe once the API contract and permission filtering are stable.

## Acceptance criteria for the first useful version

- A user cannot retrieve or infer another organization’s records, even by guessing IDs.
- Every displayed metric can be traced to source records and its calculation basis.
- Cash and accrual views are separate and clearly labeled.
- Recommendations separate evidence from hypotheses and do not execute actions without approval.
- Missing data is surfaced as a limitation, not filled with invented numbers.
- The same input and metric definition produce reproducible financial calculations.
- The Universe visualization consumes server-authorized results and does not independently calculate financial truth.
