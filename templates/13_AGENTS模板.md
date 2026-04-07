# AGENTS 模板

```md
# AGENTS.md

## Scope

This file defines project-level operating rules for AI agents working in this repository.

## Core Gates

- Requirements must be confirmed by the requester before handoff to the next role.
- Architecture options must include trade-offs and be confirmed by the requester before implementation preparation.
- If the platform supports sub-agents, run one role per sub-agent by default.
- Every stage must produce a handoff record.

## Project Outputs

- Store project artifacts under `project-docs/`.
- Use these directories:
  - `project-docs/00_intake/`
  - `project-docs/01_requirements/`
  - `project-docs/02_planning/`
  - `project-docs/03_solution/`
  - `project-docs/04_implementation/`
  - `project-docs/05_validation/`
  - `project-docs/06_handoffs/`
  - `project-docs/07_closure/`

## Role Execution

- Governance decides required roles and gates.
- Each role reads only the artifacts it needs.
- Final confirmation, test conclusion, security conclusion, database conclusion, and closure decision cannot be delegated away from the responsible role.

## Validation

- Functional testing and integration testing are required unless explicitly marked not applicable.
- Failed validation triggers rework and re-handoff.

## Stop Conditions

- Stop if requirements are not confirmed.
- Stop if architecture choice is not confirmed.
- Stop if required evidence or handoff artifacts are missing.
```
