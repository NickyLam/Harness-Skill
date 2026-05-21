---
name: harness-engineering-skill
description: "Use when the user requests a full software delivery pipeline (spec→plan→build→test→review→ship), multi-agent collaboration with role isolation, TDD workflow, quality gates, or mentions /harness commands. Also use for SDD, strict stage-gated development, or when the user says '专家团', 'expert team', or needs disciplined software delivery. Not for simple one-off coding tasks or single-file edits."
---

# Harness Engineering Skill

Version: 4.0.0

Harness is a thin orchestration skill for disciplined software delivery. Keep this file as the router; load only the stage, role, profile, and gate references needed for the current request.

## Execution Mode Decision

Before acting, determine the execution mode:

| Condition | Mode | Mechanism |
|---|---|---|
| Multi-agent environment available + user requests full pipeline or complex task | **Expert Team** | TeamCreate + Agent spawn (see Expert Team Mode below) |
| Single-agent environment or simple task | **Single Agent** | Read role MD + capsule SKILL.md sequentially (backward compatible) |

When in doubt, default to **Single Agent** mode. Switch to Expert Team only when:
- The user explicitly requests "专家团" / "expert team" / multi-agent mode
- The task spans 3+ stages and parallelism is beneficial
- The environment supports TeamCreate and Agent tools

## Expert Team Mode

When Expert Team mode is active, follow this orchestration protocol:

### 1. Activate Team Lead
Read `.workbuddy/agents/harness-team-lead.yaml` and adopt the Team Lead persona. The Team Lead is responsible for:
- Parsing user intent → determining starting stage
- Spawning role Agents via Agent tool
- Running Gate checks between stages
- Coordinating parallel execution in build stage
- Summarizing and delivering final results

### 2. Role Agent Mapping

| Stage | Agent YAML | Spawn Name | max_turns |
|---|---|---|---|
| spec | `.workbuddy/agents/harness-po.yaml` | harness-po | 20 |
| plan | `.workbuddy/agents/harness-architect.yaml` | harness-architect | 15 |
| build | `.workbuddy/agents/harness-implementer.yaml` | harness-implementer | 15 |
| test | `.workbuddy/agents/harness-tester.yaml` | harness-tester | 15 |
| review | `.workbuddy/agents/harness-reviewer.yaml` | harness-reviewer | 15 |
| simplify | `.workbuddy/agents/harness-reviewer.yaml` | harness-reviewer | 15 |
| ship | `.workbuddy/agents/harness-shipper.yaml` | harness-shipper | 12 |

### 3. Stage Orchestration Flow

```
User Intent → Team Lead parses → determines stages
    ↓
For each stage (sequential):
    1. Read Agent YAML for the role
    2. Prepare context from previous stage output
    3. Spawn Agent: Agent({name, description, prompt, subagent_type: "general-purpose", max_turns})
    4. Wait for completion (check TaskList)
    5. Run Gate check (Bash: core/skills/cross-cutting/gating/scripts/check-{stage}-gate.sh)
    6. Gate PASS → next stage
    7. Gate FAIL → SendMessage fix instruction to Agent, re-run
```

### 4. Build Stage Parallel Execution

In the build stage, when the plan contains multiple Waves:
- Same Wave, independent tasks → `Agent(run_in_background=true)` for each task
- Cross-Wave → wait for all Agents in previous Wave to complete
- Use `TaskList` with `addBlockedBy` to manage dependencies
- Use `SendMessage` for inter-Agent coordination

### 5. Review Mini-Wave Fix Loop

When Reviewer finds P0/P1 issues:
1. Team Lead spawns new Implementer Agent with fix instructions
2. After fix, spawn new Reviewer Agent for re-review
3. Loop until P1 cleared or max 2 fix rounds

### 6. Degradation

If Expert Team mode fails or is unavailable:
- Fall back to Single Agent mode
- Read role MD files sequentially
- Output warning: "⚠️ 当前为单 Agent 降级模式，角色隔离受限"

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
| `/harness evolve`, evolution, health check | Evolution | `core/evolution/evolution-loop.md` |
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
