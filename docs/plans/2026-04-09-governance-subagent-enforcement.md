# Governance Subagent Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make governance explicitly responsible for launching or restoring resident role subagents during feature iteration and bug-fix re-entry.

**Architecture:** Tighten wording in governance, project-manager, workflow rules, and README so role execution starts from governance dispatch instead of implicit self-activation by role skills. Preserve the existing resident-agent registry and fallback model.

**Tech Stack:** Markdown documentation and skill files

---

### Task 1: Record the governance enforcement rule

**Files:**
- Create: `docs/plans/2026-04-09-governance-subagent-enforcement.md`
- Modify: `skills/harness-governance/SKILL.md`

**Step 1: Update governance rules**

State that when the platform supports subagents, governance must actively launch or restore the matching resident role agent at role entry, implementation start, bug-fix re-entry, and retest re-entry.

**Step 2: Update stop conditions**

State that it is blocking if supported platforms skip governance dispatch and go straight to serial or implicit role execution.

### Task 2: Align project manager and shared workflow docs

**Files:**
- Modify: `skills/harness-project-manager/SKILL.md`
- Modify: `docs/03_多角色协作工作流规范_v1.md`
- Modify: `docs/04_角色治理规则与总控要求.md`
- Modify: `README.md`

**Step 1: Update project manager responsibilities**

Make project manager explicitly verify governance has launched or restored the correct resident role subagent before feature implementation, bug-fix rework, and retest.

**Step 2: Update shared workflow wording**

Make the public workflow text say governance dispatches resident role subagents instead of leaving launch responsibility vague.

### Task 3: Verify doc consistency

**Files:**
- Modify: `skills/harness-governance/SKILL.md`
- Modify: `skills/harness-project-manager/SKILL.md`
- Modify: `docs/03_多角色协作工作流规范_v1.md`
- Modify: `docs/04_角色治理规则与总控要求.md`
- Modify: `README.md`

**Step 1: Run diff hygiene**

Run: `git diff --check`
Expected: PASS
