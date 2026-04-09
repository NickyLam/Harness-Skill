# Skill Token Trim Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce repeated token-heavy phrasing inside `skills/*.md` without changing workflow semantics, hard gates, or repository structure.

**Architecture:** Keep the existing skill structure, but compress repeated prose, merge redundant bullets, and shorten recurring sub-agent/OpenSpec language. Leave `docs/` and `templates/` mostly untouched so the detailed reference material remains available outside skill injection.

**Tech Stack:** Markdown skill docs

---

### Task 1: Trim governance wording

**Files:**
- Modify: `skills/harness-governance/SKILL.md`

**Step 1: Shorten repeated rule phrasing**

Compress long rule bullets while preserving hard gates, role separation, resident sub-agent rules, and OpenSpec requirements.

**Step 2: Shorten stage and stop-condition wording**

Preserve the same conditions but remove explanatory duplication.

### Task 2: Trim role-skill repetition

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

**Step 1: Compress repeated resident-sub-agent language**

Shorten overview, parallel-use, and pre-start wording while keeping the same policy.

**Step 2: Compress repeated OpenSpec wording**

Keep the hard gate but reduce repeated explanatory sentences.

### Task 3: Verify token reduction

**Files:**
- Read only: `skills/*.md`

**Step 1: Compare line and byte counts before/after**

Measure whether the trimmed skills are materially smaller.
