# Service Ownership and Naming Baseline

This document defines canonical service ownership where naming overlap exists.
It is a low-risk normalization layer: no API intent changes are introduced here.

## Naming policy (current baseline)

- Deployable units should prefer `*-service` naming.
- `*-engine` names are tolerated for existing services but should be treated as legacy where a matching `*-service` exists.
- `*-orchestration` is reserved for cross-domain process coordination.

## Canonical ownership map

### Canonical + legacy alias pairs

- Canonical: `aml-monitoring-service`
  Legacy alias: `aml-monitoring`

- Canonical: `rbac-service`
  Legacy alias: `rbac-engine`

- Canonical: `regulatory-reporting-service`
  Legacy alias: `regulatory-reporting`

### Parallel domains kept distinct for now (intentional, do not merge blindly)

- `treasury-operations` vs `treasury-service`
  Keep both until endpoint and workflow ownership is fully reconciled.

- `reconciliation-service` vs `cross-system-reconciliation`
  Keep both; one is job-oriented and one is broad cross-system status/run skeleton.

- `admin-ops-service` vs `ops-dashboard-service`
  Keep both: admin control APIs vs operational dashboard query APIs.

- `feature-flag-service` vs `config-service`
  Keep both; avoid introducing new feature-flag APIs in `config-service` going forward.

## Deployment guidance

- Prefer deploying only canonical owners in new environments.
- Treat legacy alias services as compatibility surfaces during transition.
- Route new gateway integrations and automation to canonical services first.

## Future consolidation guardrails

- Consolidate only after behavior parity tests exist.
- Preserve API compatibility with explicit deprecation windows.
- Update this map before adding new same-domain services.
