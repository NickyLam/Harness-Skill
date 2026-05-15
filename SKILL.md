---
name: harness-engineering-skill
description: "Use when the user asks to run, design, or improve a software development workflow with explicit requirements, planning, implementation, testing, review, release gates, multi-agent coordination, SDD, TDD, or Harness commands."
---

# Harness Engineering Skill

Version: 3.2.0

Harness is a thin orchestration skill for disciplined software delivery. Keep this file as the router; load only the stage, role, profile, and gate references needed for the current request.

## First Decision

Classify the user's request before acting:

| Request | Mode | Required reads |
|---|---|---|
| Full feature/project delivery | Full pipeline | `core/pipeline.yaml`, `core/skills/cross-cutting/orchestrator/SKILL.md` |
| `/harness spec`, requirements, SDD | Spec | `core/skills/spec/brainstorming/SKILL.md`, `core/skills/spec/spec-generator/SKILL.md` |
| `/harness plan`, task split, architecture plan | Plan | `core/skills/plan/writing-plans/SKILL.md`, `core/roles/architect.md` |
| `/harness build`, implementation, bugfix | Build | `core/skills/build/tdd/SKILL.md`, `core/skills/build/subagent-driven-dev/SKILL.md` |
| `/harness test`, QA, verification | Test | `core/skills/test/verification/SKILL.md` |
| `/harness review`, code quality | Review | `core/skills/review/staff-review/SKILL.md` |
| `/harness simplify`, complexity reduction | Simplify | `core/skills/review/code-simplification/SKILL.md` |
| `/harness ship`, release readiness | Ship | `core/skills/ship/ship-pipeline/SKILL.md` |
| quality gate, stage verification, pre-merge check | Gate only | `core/skills/cross-cutting/gating/SKILL.md`, `core/pipeline.yaml` |

If the user only asks a narrow question, answer the question directly after reading the smallest relevant reference. Do not run the whole pipeline unless the user asks for lifecycle execution.

## Execution Contract

For any implementation or delivery task:

1. Determine `stage`, `strictness`, `profile`, and target artifact. Default strictness is `L2-standard`.
2. Read the required stage skill and role file from the table above.
3. Produce or update an evidence ledger before claiming completion.
4. Run the relevant gate before moving to the next stage.
5. If a gate fails, stop stage advancement and return to the failing stage's fix action.
6. Use platform-supported parallel workers only when the user or current environment permits parallel agent work and tasks have disjoint ownership.

## SDD Flow

Spec-driven work must produce an approved intent before implementation:

1. Capture user goal, users, constraints, risks, and success criteria.
2. Compare 2-3 solution options when the decision is non-trivial.
3. Write acceptance criteria that can be tested.
4. Generate the stage artifact under `.harness/specs/`.
5. Run `spec_gate` before planning.

Use GHBANK process documents only when the user mentions GHBANK, banking compliance, enterprise process documentation, or explicitly requests those templates. The templates live in `doc_template/`.

## TDD Flow

Build-stage behavior changes must follow RED-GREEN-REFACTOR:

1. RED: write or update a failing test that expresses one observable behavior.
2. GREEN: change the minimum implementation needed to pass that test.
3. REFACTOR: improve structure while all tests remain green.
4. Record commands, outputs, changed files, and test evidence in the ledger.

Do not claim TDD compliance from intent alone. The evidence must show the failing test before the passing run.

## Evidence Ledger

Create or update `.harness/evidence/<task-id>.json` for implementation work:

```json
{
  "taskId": "short-kebab-id",
  "stage": "build",
  "strictness": "L2-standard",
  "profile": "react-typescript",
  "requirements": ["source spec or acceptance criterion"],
  "red": [{"command": "npm test -- name", "result": "failed", "outputRef": "summary"}],
  "green": [{"command": "npm test -- name", "result": "passed", "outputRef": "summary"}],
  "refactor": [{"command": "npm test", "result": "passed", "outputRef": "summary"}],
  "changedFiles": ["src/example.ts", "src/example.test.ts"],
  "gates": [{"gate": "build_gate", "result": "passed"}]
}
```

If the task is documentation-only, use a short Markdown evidence note instead of forcing fake TDD fields.

## Gates

Gate definitions are the source of truth in `core/pipeline.yaml`.

| Gate | Blocks transition unless evidence passes |
|---|---|
| `spec_gate` | requirements/spec completeness |
| `plan_gate` | executable task plan and dependencies |
| `build_gate` | compilation/build and bounded change size |
| `test_gate` | tests, coverage, and new-code test evidence |
| `review_gate` | severity-classified review findings |
| `simplify_gate` | complexity and dead-code checks |
| `ship_gate` | final build, clean release state, previous gates |

Use the runtime checks when available:

```bash
npm run schema:validate
npm run skill:validate
npm run sync:validate
npm run pressure:validate
npm test
```

## Profiles

Use the smallest applicable profile:

| Profile | When to use | Reference |
|---|---|---|
| `generic` | Unknown stack or mixed repository | `core/profiles/generic.yaml` |
| `react-typescript` | React, TypeScript, Vite frontend | `core/profiles/react-typescript.yaml` |
| `python` | Python service or library | `core/profiles/python.yaml` |
| `go` | Go service or CLI | `core/profiles/go.yaml` |
| `java` | Java/Maven service | `core/profiles/java.yaml` |
| `ghbank-compliance` | Explicit banking/GHBANK process docs | `doc_template/` |

## Done Criteria

A Harness task is done only when:

- The requested artifact exists.
- The required stage skill was followed.
- Relevant tests or checks ran, or the reason they could not run is documented.
- The evidence ledger or audit note names the commands and results.
- The relevant gate passed or the user explicitly accepted a documented override.

## Maintenance

Use these checks when editing this skill itself:

```bash
npm run schema:validate
npm run skill:validate
npm run sync:validate
npm run pressure:validate
npm test
```

Keep `SKILL.md`, `skill-dist/SKILL.md`, `package.json`, `core/registry.yaml`, and `core/pipeline.yaml` version references aligned. Keep all referenced paths real. Keep pressure scenarios in `templates/evolution/skill-pressure-scenarios.yaml`.
