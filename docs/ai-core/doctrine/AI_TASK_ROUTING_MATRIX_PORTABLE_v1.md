# AI Task Routing Matrix — Portable v1

> **Version**: Portable v1 | **Status**: Active
> **Source**: Extracted from Unit Talk AI Task Routing Matrix v1
> **Purpose**: Project-agnostic routing reference. Adapt by filling `[PROJECT_*]` slots.

---

## Purpose

Quick-reference routing table for multi-AI workflows.

For any serious task:
1. Identify the closest matching task type
2. Start with the recommended first tool
3. Gather the required context/artifacts
4. Follow the downstream path
5. Ensure Claude OS verification is used where required

If a task is ambiguous or spans multiple categories, default to ChatGPT first.

---

## Routing Matrix

| Task Type | Typical Examples | First Tool | Required Context Before Starting | Downstream Flow | Claude OS Required |
|---|---|---|---|---|---|
| Architecture Design | subsystem design, platform refactor, boundary decisions, scaling approach | ChatGPT | Fresh context bundle | ChatGPT → Claude Code → Claude OS | Yes |
| Sprint Shaping / Sequencing | next sprint selection, roadmap tradeoffs, execution ordering | ChatGPT | Fresh context bundle, relevant status docs | ChatGPT → Claude Code if implementation follows → Claude OS | Usually |
| Workflow / Process Design | AI workflow, operator process, handoff flow, governance improvements | ChatGPT | Fresh context bundle, relevant workflow docs | ChatGPT → Claude Code if docs/scripts change → Claude OS | Yes if repo artifacts change |
| Repo Implementation | scoped code change, clear refactor, file creation, package wiring | Claude Code | Structured implementation prompt, source of truth, constraints | Claude Code → Claude OS | Yes |
| Live System Diagnosis | health issue, stuck state, platform degradation | MCP / Claude Skills | Relevant skill outputs first; context bundle if diagnosis is escalated | Skills/MCP → ChatGPT → Claude Code if fix required → Claude OS | Yes if code changes |
| `[PROJECT_DOMAIN]` Diagnosis | `[project-specific lifecycle trace, state inspection]` | MCP / Claude Skills | Relevant project skills, context bundle if escalation needed | Skills/MCP → ChatGPT → Claude Code if fix required → Claude OS | Yes if behavior changes |
| SLO / Reliability Review | breach review, health degradation, service quality analysis | MCP / Claude Skills | Health + SLO skill outputs, context bundle if escalation needed | Skills/MCP → ChatGPT → Claude Code if remediation required → Claude OS | Yes if changes land |
| Domain Intelligence Review | `[project-specific model/data/quality analysis]` | ChatGPT | Fresh context bundle, relevant domain artifacts, skill outputs if available | ChatGPT → Claude Code if changes approved → Claude OS | Yes if behavior changes |
| Governance / Sprint Closeout Review | proof review, closeout quality, invariant compliance | Claude OS | Sprint artifacts, proof bundle, closeout docs | Claude OS → ChatGPT if analytical review needed | Yes |
| Prompt / Handoff Design | Claude prompt shaping, implementation prompt refinement | ChatGPT | Fresh context bundle if repo-specific; doctrine/playbook if workflow-related | ChatGPT → Claude Code if template files are updated → Claude OS | Yes if repo artifacts change |
| Documentation Architecture | canonical docs, doctrine updates, repo operating docs | ChatGPT | Fresh context bundle, source-of-truth docs | ChatGPT → Claude Code → Claude OS | Yes |
| Small Low-Risk Mechanical Task | obvious wording tweak, tiny doc correction, straightforward low-risk edit | Claude Code or ChatGPT | Minimal context, but source of truth still required | Direct execution → Claude OS only if governed artifact changes | Sometimes |

> Context bundle: generated via your project's context generation command. See `[PROJECT_DOC_ROOT]/AI_OPERATING_DOCTRINE_v1.md`.

---

## Default Rules

### Rule 1
If you are not sure which row applies, start with ChatGPT.

### Rule 2
If the issue is about current system state, start with MCP/skills.

### Rule 3
If the task is already implementation-ready, start with Claude Code.

### Rule 4
If sprint proof, verification, or closeout quality is the question, start with Claude OS.

### Rule 5
If architecture or strategy quality matters, use a fresh context bundle first.

---

## Required Artifacts By Task Family

### Architecture / Planning
- Fresh context bundle
- Relevant roadmap/status docs
- Any current architecture constraints

### Diagnosis
- Relevant skill outputs first
- Fresh context bundle if diagnosis requires synthesis
- Explicit problem statement

### Implementation
- Structured implementation prompt
- Source of truth
- Constraints / invariants
- Verification expectations

### Governance
- Sprint artifacts
- Proof bundle
- Closeout documents
- Relevant contracts

### Domain Review
- Fresh context bundle
- Domain artifacts
- `[PROJECT_SPECIFIC_EVIDENCE]` if available

---

## Escalation Rules

### Escalate to ChatGPT when:
- the diagnosis is no longer mechanical
- multiple subsystems are involved
- tradeoffs need to be evaluated
- the implementation path is unclear
- the problem touches architecture, workflow, or long-term maintainability

### Escalate to Claude Code when:
- the fix is implementation-ready
- the required files and constraints are known
- the task is clearly scoped

### Escalate to Claude OS when:
- behavior changed
- verification is needed
- proof is required
- sprint state is changing
- closeout or ratification is needed

---

## Anti-Patterns

- Starting in Claude Code for unresolved architecture questions
- Starting in ChatGPT for a live-system issue without skill outputs
- Treating implementation as complete before Claude OS verification
- Asking for strategy/domain guidance without a fresh context bundle
- Mixing diagnosis, implementation, and governance into one vague request

---

## Mental Model Shortcut

- **Static reasoning** → context bundle → ChatGPT
- **Dynamic system truth** → MCP/skills first
- **Scoped repo execution** → Claude Code
- **Verification / proof / closeout** → Claude OS

---

## Adaptation Instructions

When installing this matrix in a new project:

1. Replace `[PROJECT_DOMAIN]` rows with your project's domain-specific diagnosis scenarios
2. Replace `[PROJECT_DOC_ROOT]` with your actual doc path
3. Replace `[PROJECT_SPECIFIC_EVIDENCE]` with your project's evidence sources
4. Keep all generic rows as-is — they apply to every project
5. Remove this section when done adapting

---

## Related Documents

| Document | Purpose |
|---|---|
| `[PROJECT_DOC_ROOT]/AI_OPERATING_DOCTRINE_v1.md` | Official policy layer for AI workflow |
| `[PROJECT_DOC_ROOT]/LLM_DECISION_PLAYBOOK.md` | Role definitions and model selection |
| `[PROJECT_DOC_ROOT]/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | Standard implementation handoff |
| `[PROJECT_DOC_ROOT]/AI_PREFLIGHT_CHECKLIST_v1.md` | Pre-task checklist |
