# OpenSpec Hard Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn OpenSpec from a soft expectation into a hard governance gate that blocks stage progression when required OpenSpec artifacts are missing, outdated, or inconsistent with current work.

**Architecture:** Tighten the governance rules first, then update project-manager responsibilities, then add explicit OpenSpec audit fields and templates so every stage records the required evidence. Finally, align all role skills so each role checks OpenSpec before proceeding and stops when OpenSpec is missing or stale.

**Tech Stack:** Markdown governance docs, Markdown templates, role skill docs

---

### Task 1: Tighten governance and workflow rules

**Files:**
- Modify: `skills/harness-governance/SKILL.md`
- Modify: `docs/03_多角色协作工作流规范_v1.md`
- Modify: `docs/04_角色治理规则与总控要求.md`
- Modify: `docs/02_标准角色模型_v1.md`

**Step 1: Add hard OpenSpec stage gates**

Document that:
- `proposal.md` is required before leaving intake / confirmed requirements
- `design.md` is required before solution handoff and implementation prep
- `tasks.md` is required before implementation prep and implementation start
- scope, design, or task changes must update OpenSpec before the next handoff

**Step 2: Add hard stop conditions**

Document that missing, stale, or inconsistent OpenSpec artifacts force `不可交接`.

**Step 3: Add project manager audit responsibility**

Require the project manager to audit OpenSpec existence, freshness, and consistency before allowing progression.

### Task 2: Add OpenSpec audit artifacts and template fields

**Files:**
- Create: `templates/15_OpenSpec审计模板.md`
- Modify: `templates/00_任务入口模板.md`
- Modify: `templates/02_任务拆解模板.md`
- Modify: `templates/03_方案决策模板.md`
- Modify: `templates/04_实现交接模板.md`
- Modify: `templates/05_测试结论模板.md`
- Modify: `templates/08_项目收口模板.md`
- Modify: `templates/10_实现准备模板.md`
- Modify: `templates/11_联调结论模板.md`
- Modify: `templates/12_通用交接模板.md`
- Modify: `templates/13_AGENTS模板.md`

**Step 1: Add OpenSpec fields**

Add fields for:
- OpenSpec change path
- required OpenSpec artifacts
- update status
- consistency check result

**Step 2: Add a dedicated PM audit template**

Create a reusable OpenSpec audit checklist for project-manager stage reviews.

### Task 3: Tighten role skill stop conditions

**Files:**
- Modify: `skills/harness-project-manager/SKILL.md`
- Modify: `skills/harness-requirements-analyst/SKILL.md`
- Modify: `skills/harness-architect/SKILL.md`
- Modify: `skills/harness-frontend-engineer/SKILL.md`
- Modify: `skills/harness-backend-engineer/SKILL.md`
- Modify: `skills/harness-test-engineer/SKILL.md`
- Modify: `skills/harness-security-auditor/SKILL.md`
- Modify: `skills/harness-dba/SKILL.md`
- Modify: `skills/harness-release-manager/SKILL.md`
- Modify: `skills/harness-observability-engineer/SKILL.md`

**Step 1: Add pre-start OpenSpec checks**

Require each role to verify the OpenSpec artifacts it depends on before starting.

**Step 2: Add stop conditions**

Require each role to stop and return to PM or upstream role when OpenSpec is missing, stale, or inconsistent.

### Task 4: Sync README and output guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/05_项目产物落盘规范_v1.md`

**Step 1: Clarify directory responsibilities**

Make `openspec/` the source of truth for change definition and `project-docs/` the source of truth for execution evidence.

**Step 2: Document the hard-gate rule**

Explain that missing OpenSpec artifacts block progression and closure.
