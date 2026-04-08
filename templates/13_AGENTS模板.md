# AGENTS 模板

```md
# AGENTS.md

## Scope

This file defines project-level operating rules for AI agents working in this repository.

## Core Gates

- Requirements must be confirmed by the requester before handoff to the next role.
- Architecture options must include trade-offs and be confirmed by the requester before implementation preparation.
- The project manager must require any role making a change to follow OpenSpec strictly.
- Bug fixing or rework must return to the matching role skill instead of being handled by governance or an unrelated role.
- If the platform supports sub-agents, run one role per sub-agent by default.
- If the platform supports sub-agents, each activated role must first attempt to launch its role sub-agent.
- If launch fails because of model availability or transient platform errors, retry up to 5 times before falling back.
- Every stage must produce a handoff record.

## Project Outputs

- Initialize OpenSpec at the project root:
  - `openspec/config.yaml`
  - `openspec/changes/`
  - `openspec/changes/archive/`
  - `openspec/specs/`
- Use `openspec/changes/<change>/proposal.md`, `design.md`, and `tasks.md` for change-level planning and governance.
- Use `openspec/specs/<capability>/spec.md` for long-lived capability rules.
- Store execution evidence under `project-docs/`.
- Use these `project-docs/` directories:
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
- Roles other than the project manager may use suitable superpower-series skills flexibly as execution aids.
- Each role reads only the artifacts it needs.
- Final confirmation, test conclusion, security conclusion, database conclusion, and closure decision cannot be delegated away from the responsible role.

## Validation

- Functional testing and integration testing are required unless explicitly marked not applicable.
- Failed validation triggers rework and re-handoff.

## Stop Conditions

- Stop if requirements are not confirmed.
- Stop if architecture choice is not confirmed.
- Stop if `openspec/` has not been initialized according to project rules.
- Stop if required evidence or handoff artifacts are missing.
```
