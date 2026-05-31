# AI Operating Doctrine — Portable v1

> **Version**: Portable v1 | **Status**: Active
> **Source**: Extracted from Unit Talk AI Operating Doctrine v1
> **Purpose**: Project-agnostic multi-AI operating model. Adapt to your project by filling `[PROJECT_*]` placeholders.

---

## Purpose

This document defines the AI operating model for software projects that use a multi-AI workflow.

Its purpose is to ensure work is routed through the correct AI systems in the correct order so that architecture quality, implementation quality, verification quality, and operator efficiency improve over time.

This doctrine eliminates:
- ambiguous tool routing
- duplicated reasoning
- wasted prompting
- low-context decisions
- unverifiable implementation loops
- drift between architecture, implementation, and governance

---

## Scope

This doctrine governs how work flows through:
- ChatGPT (or other architecture/reasoning AI)
- Claude Code
- Claude OS
- MCP servers and skills
- AI context bundle artifacts

It applies to:
- architecture decisions
- implementation work
- incident diagnosis
- governance review
- operator workflows
- domain review

It does not change runtime system invariants, application contracts, or production authority boundaries. It governs how humans and AI collaborate around those systems.

---

## Core Principle

This project uses a **multi-AI operating model**.

Each AI/tool has a distinct role:

| Tool | Role |
|---|---|
| **ChatGPT** | Architecture, audits, reasoning, sprint shaping, high-level diagnosis |
| **Claude Code** | Repo implementation and code modification |
| **Claude OS** | Governance, proof, verification, closeout, sprint lifecycle |
| **MCP + Skills** | Structured operational/system truth for diagnostics and inspection |
| **AI Context Bundle** | Snapshot bridge that gives ChatGPT structured awareness of current system |

The system is strongest when each tool stays in its lane.

---

## AI System Roles

### 1. ChatGPT

ChatGPT is the **architecture and reasoning layer**.

Use ChatGPT for:
- architecture design
- roadmap sequencing
- sprint shaping
- workflow design
- domain review
- system simplification
- tradeoff analysis
- high-level incident diagnosis
- converting complex intent into implementation-ready prompts

ChatGPT should usually be the **first stop** when:
- the task is ambiguous
- the problem is architectural
- the correct implementation approach is not yet settled
- a diagnosis requires synthesis across multiple systems
- the operator wants strategic guidance, not just code edits

ChatGPT should **not** be treated as the primary repo editor.

> See `[PROJECT_DOC_ROOT]/LLM_DECISION_PLAYBOOK.md` for the detailed tool routing guide.

---

### 2. Claude Code

Claude Code is the **implementation layer**.

Use Claude Code for:
- code changes
- file creation
- repo edits
- package wiring
- refactors
- controlled implementation tasks
- code-level follow-through on approved architecture

Claude Code should usually be the **first stop** when:
- the task is already clear
- the implementation path is settled
- a scoped prompt already exists
- the work is primarily in-repo execution

Claude Code should **not** be used as the first tool for unresolved architectural ambiguity unless the task is trivial.

---

### 3. Claude OS

Claude OS is the **governance and verification layer**.

Use Claude OS for:
- sprint lifecycle management
- verification
- proof generation
- closeout
- tags
- findings/backlog automation
- status sync
- controlled progression of sprint state

Claude OS should be invoked whenever work changes system behavior and needs governed verification.

Claude OS is not a substitute for architecture reasoning or ad-hoc debugging.

---

### 4. MCP + Claude Skills

MCP and Claude skills are the **structured truth and diagnostics layer**.

Use MCP/skills for:
- health inspection
- system state inspection
- structured, repeatable operator diagnostics
- `[PROJECT_SPECIFIC_SKILL_1]`
- `[PROJECT_SPECIFIC_SKILL_2]`

> Project skills: `.claude/skills/` — see your project's skill definitions.

---

### 5. AI Context Bundle

The AI context bundle is the **visibility bridge for ChatGPT**.

The canonical entrypoint (adapt per project):
```bash
[project]:context
# generates: out/ai/context/context_bundle.md
```

This generates a structured, ChatGPT-pasteable snapshot of current repo and system truth.

The context bundle should be treated as the default preflight input for serious ChatGPT work.

---

## Task Lanes

All serious work should enter through one of the following lanes.

### Lane 1 — Architecture Lane

Use when:
- deciding system design
- sequencing roadmap work
- resolving tradeoffs
- designing a new subsystem
- simplifying complexity
- shaping a sprint before implementation

Flow:
1. Generate a fresh context bundle
2. Bring the context bundle to ChatGPT
3. Ask for architecture output, audit output, or sprint shaping
4. Convert the result into a Claude Code implementation prompt
5. Route completed implementation through Claude OS verification

Owner: ChatGPT first → Claude Code second → Claude OS final

---

### Lane 2 — Diagnosis Lane

Use when:
- a platform issue exists
- system state is unclear
- a live-system issue requires structured diagnosis

Flow:
1. Run the relevant project skills first
2. Gather structured outputs
3. Run context bundle if diagnosis requires multi-system synthesis
4. Bring skill outputs + context bundle to ChatGPT
5. Ask for diagnosis, root cause, and fix strategy
6. If code changes are required, route implementation to Claude Code
7. Verify fixes through Claude OS

Owner: MCP/skills first → ChatGPT second → Claude Code third → Claude OS final

---

### Lane 3 — Implementation Lane

Use when:
- the work is already clearly defined
- architecture is already settled
- the task is implementation-ready
- only repo execution remains

Flow:
1. Start with a structured implementation prompt
2. Send directly to Claude Code
3. Route the result through Claude OS verification
4. Bring back to ChatGPT only if architectural review is needed

Owner: Claude Code first → Claude OS second

---

### Lane 4 — Governance Lane

Use when:
- reviewing sprint proof
- validating closeout quality
- checking compliance with invariants
- deciding whether a sprint is truly complete
- reconciling governance artifacts or status docs

Flow:
1. Gather Claude OS artifacts
2. Bring to ChatGPT if analytical review is needed
3. Resolve gaps
4. Close and sync using Claude OS

Owner: Claude OS first → ChatGPT second if needed

---

### Lane 5 — Domain Review Lane

Use when:
- conducting domain-specific analysis
- reviewing system output quality
- evaluating performance against domain criteria
- `[PROJECT_SPECIFIC_DOMAIN_REVIEW_TRIGGER]`

Flow:
1. Generate a fresh context bundle
2. Add task-specific domain artifacts
3. Use relevant skill outputs if available
4. Ask ChatGPT for analysis
5. Route approved implementation work to Claude Code
6. Verify via Claude OS if system behavior changes

Owner: ChatGPT first → Claude Code second → Claude OS final

---

## Mandatory Routing Rules

### Rule 1
If the task is ambiguous, start in ChatGPT.

### Rule 2
If the task is a live-system issue, use MCP/skills first.

### Rule 3
If the task is implementation-ready and well-scoped, go directly to Claude Code.

### Rule 4
If the task changes system behavior, Claude OS verification is mandatory before calling it complete.

### Rule 5
If the task needs high-quality ChatGPT reasoning, the latest context bundle is mandatory.

### Rule 6
If the task concerns system state, runtime health, or live diagnostics, include skill outputs in addition to the context bundle.

### Rule 7
No serious architecture or roadmap decision should rely on memory alone when a context bundle is available.

### Rule 8
Reasoning, implementation, governance, and diagnostics should remain separated unless a task is intentionally small and low-risk.

---

## Preflight Standard

Before serious work begins, the operator should determine:

1. Which task lane applies
2. Whether a fresh context bundle is required
3. Whether skill outputs are required
4. Whether the task is architecture-first or implementation-ready
5. Whether Claude OS verification will be required at the end

> Full preflight checklist: `[PROJECT_DOC_ROOT]/AI_PREFLIGHT_CHECKLIST_v1.md`

---

## ChatGPT → Claude Code Handoff Standard

Any implementation handoff originating from ChatGPT should include:

1. Objective
2. Why it matters
3. Scope
4. Non-goals
5. Source of truth
6. Constraints / invariants
7. Exact implementation tasks
8. Verification steps
9. Output format
10. Success criteria

> Handoff template: `[PROJECT_DOC_ROOT]/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md`

---

## Verification and Closeout Standard

Claude OS should be used whenever the work:
- modifies behavior
- changes contracts
- affects lifecycle logic
- affects production-facing workflows
- materially changes operator tooling
- advances sprint status

Work is not complete merely because code was written. Work is complete when:
- implementation is landed
- verification is run
- proof is produced
- status is reconciled
- closeout is governed

---

## Anti-Patterns

- Asking Claude Code to solve unresolved architecture ambiguity first
- Asking ChatGPT for high-confidence guidance without current context
- Skipping skill-based diagnostics for live-system issues
- Treating implementation as "done" before Claude OS verification
- Mixing reasoning, implementation, and governance into one vague prompt
- Making roadmap decisions from memory when a context bundle is available
- Allowing AI tools to drift outside their role boundaries without justification

---

## Operating Standard

The standard flow is:

```
Intent
→ classify task lane
→ gather required context and/or skill outputs
→ route to the correct AI/tool first
→ perform implementation only after reasoning is settled
→ verify and close through Claude OS
→ preserve artifacts for future reasoning
```

---

## Adaptation Instructions

When installing this doctrine in a new project:

1. Replace `[PROJECT_DOC_ROOT]` with the actual path (e.g., `docs/ai/`)
2. Replace `[project]:context` with your context bundle generation command
3. Fill in `[PROJECT_SPECIFIC_SKILL_*]` with the actual diagnostic skills your project has
4. Fill in `[PROJECT_SPECIFIC_DOMAIN_REVIEW_TRIGGER]` with your project's domain review trigger
5. Update the "Related Documents" section with real doc paths
6. Remove this section when done adapting

---

## Related Documents

| Document | Role |
|---|---|
| `[PROJECT_DOC_ROOT]/AI_TASK_ROUTING_MATRIX_v1.md` | Quick routing lookup |
| `[PROJECT_DOC_ROOT]/LLM_DECISION_PLAYBOOK.md` | Tool roles and model selection |
| `[PROJECT_DOC_ROOT]/AI_PREFLIGHT_CHECKLIST_v1.md` | Pre-task quality gate |
| `[PROJECT_DOC_ROOT]/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Handoff format |
| `[PROJECT_GOVERNANCE_CONTRACT]` | Sprint execution rules |
