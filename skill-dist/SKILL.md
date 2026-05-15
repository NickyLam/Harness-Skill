---
name: harness-engineering-skill
description: "Use when the user asks to run, design, or improve a software development workflow with explicit requirements, planning, implementation, testing, review, release gates, multi-agent coordination, SDD, TDD, or Harness commands."
---

# Harness Engineering Skill

Version: 3.2.0

Harness is a thin orchestration skill for disciplined software delivery. This distribution uses `capsules/` for stage skills and `roles/` for role guidance.

## First Decision

Classify the user's request before acting:

| Request | Mode | Required reads |
|---|---|---|
| Full feature/project delivery | Full pipeline | `capsules/orchestrator/SKILL.md`, `gating/gate-definitions.yaml` |
| `/harness spec`, requirements, SDD | Spec | `capsules/brainstorming/SKILL.md`, `capsules/spec-generator/SKILL.md` |
| `/harness plan`, task split, architecture plan | Plan | `capsules/writing-plans/SKILL.md`, `roles/architect/SKILL.md` |
| `/harness build`, implementation, bugfix | Build | `capsules/tdd/SKILL.md`, `capsules/subagent-driven-dev/SKILL.md` |
| `/harness test`, QA, verification | Test | `capsules/verification/SKILL.md` |
| `/harness review`, code quality | Review | `capsules/staff-review/SKILL.md` |
| `/harness simplify`, complexity reduction | Simplify | `capsules/code-simplification/SKILL.md` |
| `/harness ship`, release readiness | Ship | `capsules/ship-pipeline/SKILL.md` |
| quality gate, stage verification, pre-merge check | Gate only | `capsules/gating/SKILL.md`, `gating/gate-definitions.yaml` |

If the user only asks a narrow question, answer the question directly after reading the smallest relevant reference. Do not run the whole pipeline unless the user asks for lifecycle execution.

## Execution Contract

For implementation or delivery work:

1. Determine `stage`, `strictness`, `profile`, and target artifact. Default strictness is `L2-standard`.
2. Read only the required capsule and role files for the current stage.
3. Produce or update evidence before claiming completion.
4. Run the relevant gate before moving to the next stage.
5. If a gate fails, stop stage advancement and return to the failing stage's fix action.
6. Use parallel workers only when the user or current platform permits parallel agent work and tasks have disjoint ownership.

## SDD And TDD

Spec-driven work must produce acceptance criteria before implementation. Build-stage behavior changes must follow RED-GREEN-REFACTOR:

1. RED: write or update a failing test for one observable behavior.
2. GREEN: change the minimum implementation needed to pass that test.
3. REFACTOR: improve structure while all tests remain green.
4. Record commands, outputs, changed files, and gate results.

Do not claim TDD compliance from intent alone. The evidence must show the failing test before the passing run.

Use GHBANK process documents only when the user mentions GHBANK, banking compliance, enterprise process documentation, or explicitly requests those templates. If the process templates are not bundled with the installed distribution, ask the user for the required template files before generating those documents.

## Evidence

Create `.harness/evidence/<task-id>.json` for implementation work with these fields:

```json
{
  "taskId": "short-kebab-id",
  "stage": "build",
  "strictness": "L2-standard",
  "requirements": ["source spec or acceptance criterion"],
  "red": [{"command": "test command", "result": "failed"}],
  "green": [{"command": "test command", "result": "passed"}],
  "refactor": [{"command": "full test command", "result": "passed"}],
  "changedFiles": ["source file", "test file"],
  "gates": [{"gate": "build_gate", "result": "passed"}]
}
```

## Done Criteria

A Harness task is done only when:

- The requested artifact exists.
- The required stage capsule was followed.
- Relevant tests or checks ran, or the reason they could not run is documented.
- Evidence names the commands and results.
- The relevant gate passed or the user explicitly accepted a documented override.

## Maintenance

When editing this distribution, keep all referenced paths real, keep `Version:` aligned with the source package, and run the source package's pressure scenario validation before release.
