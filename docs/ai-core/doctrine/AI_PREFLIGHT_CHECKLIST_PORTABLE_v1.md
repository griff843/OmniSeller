# AI Preflight Checklist — Portable v1

> **Version**: Portable v1 | **Status**: Active
> **Source**: Extracted from Unit Talk AI Preflight Checklist v1
> **Purpose**: Project-agnostic preflight gate. Adapt by filling `[PROJECT_*]` slots.

---

## Purpose

Answer five questions before every serious AI task.

Skipping this is the leading cause of wrong-tool routing, wasted prompts, and low-context implementation errors.

---

## The Five Preflight Questions

Answer these for every task before routing to any AI tool:

| # | Question | If Yes |
|---|---|---|
| 1 | Which task lane applies? | Identify from table below |
| 2 | Is a fresh context bundle required? | Run `[project]:context` before starting |
| 3 | Are skill outputs required? | Run relevant project skills first |
| 4 | Is this architecture-first or implementation-ready? | Architecture-first → ChatGPT; Implementation-ready → Claude Code |
| 5 | Will Claude OS verification be required at the end? | Yes if behavior, contracts, or sprint state changes |

---

## Task Lane Reference

| Lane | Use When | First Tool |
|---|---|---|
| Architecture | Unresolved design, tradeoff, or sprint shaping | ChatGPT + context bundle |
| Diagnosis | Live issue, unexpected system state, health failure | Project skills first |
| Implementation | Task is clear, scoped, implementation-ready | Claude Code |
| Governance | Sprint proof review, closeout, invariant compliance | Claude OS |
| Domain Review | `[project-specific domain analysis trigger]` | ChatGPT + context bundle + skill outputs |

---

## Checklist by Task Type

### Architecture / Sprint Shaping

Before starting:

- [ ] Generate a fresh context bundle (`[project]:context`)
- [ ] Confirm status docs are up to date (check `[PROJECT_STATUS_DOC]`)
- [ ] Identify the relevant roadmap position (`[PROJECT_PHASE_DOC]`)
- [ ] Define the specific architecture question or tradeoff to resolve
- [ ] Load context bundle into ChatGPT before prompting
- [ ] Use the appropriate prompt template (`[PROJECT_DOC_ROOT]/prompt-templates/architecture-audit.md`)
- [ ] Do NOT start in Claude Code — architecture ambiguity must be resolved first

---

### Diagnosis

Before starting:

- [ ] Run the relevant project skill(s) first:
  - `[project-skill-1]` — `[what it checks]`
  - `[project-skill-2]` — `[what it checks]`
  - `[project-skill-3]` — `[what it checks]`
- [ ] Gather the skill output before escalating to ChatGPT
- [ ] Define the explicit problem statement before escalating
- [ ] Run context bundle generation if diagnosis requires multi-subsystem synthesis
- [ ] If a fix is identified, create a scoped handoff before routing to Claude Code
- [ ] Do NOT start in ChatGPT without skill outputs for live-system issues

---

### Implementation

Before starting:

- [ ] Confirm the implementation path is settled — no unresolved architecture questions
- [ ] Identify the source of truth (file, contract, or pattern to follow)
- [ ] Identify constraints and invariants:
  - `[PROJECT_CONSTRAINT_1]`
  - `[PROJECT_CONSTRAINT_2]`
  - Non-negotiable invariants (`[PROJECT_EXECUTION_CONTRACT]`)
- [ ] Confirm the sprint is the next in the governed queue (`[PROJECT_SPRINT_QUEUE_DOC]`)
- [ ] Run project baseline script if applicable
- [ ] Confirm all dependencies (prior sprints) are complete
- [ ] Identify the verification plan (which gates must pass)
- [ ] Claude OS verification is required if behavior changes

---

### Governance / Sprint Closeout

Before starting:

- [ ] Gather sprint artifacts (proof bundle, closeout report, diff summary)
- [ ] Locate the relevant governance contracts:
  - `[PROJECT_GOVERNANCE_CONTRACT]`
  - `[PROJECT_EXECUTION_CONTRACT]`
- [ ] Confirm proof artifacts are in `out/sprints/<SPRINT>/<DATE>/`
- [ ] Run Claude OS for verification, tagging, and closeout
- [ ] Bring artifacts to ChatGPT only if analytical review is needed (rare)

---

### Domain Review

Before starting:

- [ ] Generate a fresh context bundle
- [ ] Run the relevant domain skill output (if available):
  - `[project-domain-skill-1]`
  - `[project-domain-skill-2]`
- [ ] Identify the specific domain question
- [ ] Load context bundle + skill outputs into ChatGPT
- [ ] If analysis produces code changes: fill the handoff template before routing to Claude Code
- [ ] Claude OS verification required if domain behavior changes

---

## Minimum Standards by Context Bundle Requirement

| Task | Context Bundle | Skill Outputs |
|---|---|---|
| Architecture / Sprint Shaping | Required | Optional |
| High-level incident diagnosis | Required | Required first |
| Domain review | Required | Recommended |
| Implementation (clear spec) | Not required | Not required |
| Governance / closeout | Not required | Not required |
| Live platform diagnostic | Not required | Required |

---

## Anti-Patterns to Catch at Preflight

- Starting Claude Code before architecture ambiguity is resolved
- Starting ChatGPT without a context bundle for codebase questions
- Skipping skill outputs for live-system issues
- Starting implementation without checking sprint queue order
- Marking work done without Claude OS verification when behavior changed

---

## Adaptation Instructions

When installing this checklist in a new project:

1. Replace `[project]:context` with your context bundle command
2. Replace `[PROJECT_STATUS_DOC]` with your project's current-state doc path
3. Replace `[PROJECT_PHASE_DOC]` with your roadmap/phase doc path
4. Fill in `[project-skill-*]` with your actual diagnostic skill invocations
5. Fill in `[PROJECT_CONSTRAINT_*]` with your project's critical invariants
6. Fill in `[PROJECT_GOVERNANCE_CONTRACT]` and `[PROJECT_EXECUTION_CONTRACT]` with actual paths
7. Fill in `[PROJECT_SPRINT_QUEUE_DOC]` with your sprint queue doc path
8. Remove this section when done adapting

---

## Related Documents

| Document | Purpose |
|---|---|
| `[PROJECT_DOC_ROOT]/AI_OPERATING_DOCTRINE_v1.md` | Preflight standard authority |
| `[PROJECT_DOC_ROOT]/AI_TASK_ROUTING_MATRIX_v1.md` | Quick routing lookup |
| `[PROJECT_DOC_ROOT]/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Handoff format after ChatGPT phase |
| `[PROJECT_DOC_ROOT]/LLM_DECISION_PLAYBOOK.md` | Which tool does what |
| `[PROJECT_SPRINT_WORKFLOW_TEMPLATE]` | Sprint execution template |
