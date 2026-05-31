# ChatGPT → Claude Code Handoff Template — Portable v1

> **Version**: Portable v1 | **Status**: Active
> **Source**: Extracted from Unit Talk ChatGPT → Claude Code Handoff Template v1
> **Purpose**: Universal 10-field handoff template. Requires zero project adaptation — use as-is.

---

## Purpose

This template standardizes implementation handoffs from ChatGPT reasoning into Claude Code execution.

A well-formed handoff:
- eliminates ambiguity
- prevents scope creep
- gives Claude Code exactly what it needs to implement correctly on the first attempt

Use this template whenever ChatGPT produces an implementation recommendation that will be executed in Claude Code.

---

## When to Use This Template

| Trigger | Use handoff template? |
|---|---|
| ChatGPT produced an architecture decision that requires code changes | Yes |
| ChatGPT diagnosed an incident and identified a code fix | Yes |
| ChatGPT shaped a sprint and produced a task list | Yes |
| Simple one-file fix with no architecture ambiguity | Optional |
| Continuing an in-progress sprint (already has context) | No — use sprint plan |

---

## Usage Guide

1. **Fill in ChatGPT** — after architecture or diagnosis output, ask ChatGPT to populate this template for the implementation it is recommending.
2. **Review before pasting** — check Scope and Non-Goals carefully. Scope creep enters here.
3. **Paste into Claude Code** — the filled template becomes the implementation prompt.
4. **Claude Code executes** — using the source of truth and constraints defined below.
5. **Verify output** — per the Verification Steps and Success Criteria sections.
6. **Route to Claude OS** — if the task changes system behavior, Claude OS verification is mandatory before marking complete.

---

## Template

Copy the block below. Fill all fields. Do not omit fields — a missing field is a known ambiguity risk.

```markdown
## Handoff: <SPRINT-NAME or short task description>

**Objective**
<One sentence: what must be true when this is done?>

**Why It Matters**
<One to two sentences: what breaks or degrades if this is not done? What does this unlock?>

**Scope**
<Explicit boundaries of what is included. Name files, subsystems, or behaviors that are in scope. Be specific.>

**Non-Goals**
<Explicit boundaries of what is NOT included. Name things that may seem related but should not be touched.>

**Source of Truth**
<The canonical reference Claude Code must consult before writing code. Usually: a docs file, an existing implementation pattern, a governance contract, or a specific file path. Name it explicitly.>

Example: `src/lib/[pattern-module]/` (existing pattern), `docs/contracts/[CONTRACT].md`

**Constraints / Invariants**
<Hard rules that cannot be violated. These typically come from:
- Project execution contract
- System invariants doc
- Any single-writer or single-authority policy
- Migration or rollback requirements>

Example:
- All [canonical table] writes must go through the designated adapter
- No direct DB writes outside the designated module
- Rollback must be possible for any schema change

**Implementation Tasks**
<Numbered, ordered list. Each task should be completable and verifiable independently.>

1.
2.
3.

**Verification Steps**
<How to confirm the implementation is correct. Include specific commands.>

- [ ] `[type-check command]` passes
- [ ] `[test command]` passes
- [ ] `[project-specific gate]` passes
- [ ] <task-specific behavioral check>

**Output Format**
<What should be delivered: diff, file list, proof artifact, test result, or a specific document?>

**Success Criteria**
<Observable, unambiguous conditions that define "done." Each must be verifiable without human interpretation.>

- <Criterion 1>
- <Criterion 2>
```

---

## Filled Example (Generic)

```markdown
## Handoff: Add authentication middleware to the admin routes

**Objective**
Protect all `/admin/*` routes with JWT verification so unauthenticated requests are rejected.

**Why It Matters**
Admin routes currently have no authentication guard. Any unauthenticated caller can access admin operations. This is a security gap that must be closed before the next release.

**Scope**
- `src/routes/admin/` — add auth middleware to all route handlers
- `src/middleware/auth.ts` — create JWT verification middleware
- Unit tests for the middleware

**Non-Goals**
- Do not change the JWT signing logic (not in this sprint)
- Do not touch public routes
- Do not add role-based access control (that is a follow-on sprint)

**Source of Truth**
- Existing auth pattern: `src/lib/auth/` (scan for how tokens are verified today)
- Route handler pattern: `src/routes/` (existing handlers show correct middleware usage)

**Constraints / Invariants**
- JWT secret must come from environment variables — never hardcoded
- 401 must be returned for missing/invalid tokens (not 403 or 500)
- Middleware must not modify the request body

**Implementation Tasks**
1. Create `src/middleware/auth.ts` with JWT verification
2. Apply middleware to all routes in `src/routes/admin/`
3. Add unit tests for valid token, expired token, and missing token scenarios

**Verification Steps**
- [ ] `npm run type-check` passes
- [ ] `npm run test` passes (including new middleware tests)
- [ ] `curl -X GET /admin/users` without a token returns 401
- [ ] `curl -X GET /admin/users` with a valid token returns 200

**Output Format**
Code diffs + test file

**Success Criteria**
- All admin routes return 401 for unauthenticated requests
- All admin routes return correct data for authenticated requests
- New unit tests cover valid, expired, and missing token scenarios
- Type check and test suite pass
```

---

## Related Documents

| Document | Purpose |
|---|---|
| `[PROJECT_DOC_ROOT]/AI_OPERATING_DOCTRINE_v1.md` | Handoff standard authority |
| `[PROJECT_DOC_ROOT]/AI_TASK_ROUTING_MATRIX_v1.md` | When to use this handoff |
| `[PROJECT_DOC_ROOT]/AI_PREFLIGHT_CHECKLIST_v1.md` | What to confirm before handing off |
| `[PROJECT_SPRINT_WORKFLOW_TEMPLATE]` | Sprint execution after handoff |
| `[PROJECT_EXECUTION_CONTRACT]` | Non-negotiable invariants |
