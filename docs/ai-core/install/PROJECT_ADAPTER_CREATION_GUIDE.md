# Project Adapter Creation Guide

**Version:** v1 | **Date:** 2026-03-16

---

## What Is a Project Adapter

A project adapter is the translation layer between the portable AI operating core and a specific project.

Without it, the portable core has no clean way to know:
- what documents matter
- what current state means
- what counts as proof
- what workflows are sensitive
- what is project-local versus reusable

The adapter is what lets helpers, hooks, and routing rules behave correctly for your project instead of guessing or defaulting to Unit Talk assumptions.

---

## When to Create One

Create a project adapter when you are:
- bootstrapping a new repo with the AI operating system
- adapting helpers or hooks that need project-specific inputs
- tired of re-explaining your project structure in every ChatGPT session

---

## Where It Lives

Name: `AI_PROJECT_ADAPTER_<YOUR_PROJECT_NAME>_v1.md`

Location: `docs/ai/` in your repo

Example: `docs/ai/AI_PROJECT_ADAPTER_POKER_TOOL_v1.md`

---

## Template Source

The full template is at: `docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md`

The Unit Talk example is at: `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`

---

## Section-by-Section Filling Guide

### Section 1 — Project Identity

Answer these questions briefly:

- **Name**: What is this project called?
- **Domain summary**: What does it do in one sentence? (e.g., "Sports picks prediction platform", "Poker hand analysis tool", "NFT drop manager")
- **Primary purpose**: What problem does it solve?
- **Operating surfaces**: Where does work happen? (e.g., "Node.js API, React frontend, Discord bot")
- **Risk profile**: What mistakes are expensive here?

**Tip**: Be specific. "A web app" is not enough. "A multi-tenant SaaS for tracking B2B contract renewals" is enough.

---

### Section 2 — Canonical Documentation Map

List your most important docs. Every helper and hook will use this.

Required:
- **Roadmap docs**: What defines what gets built and in what order?
- **Current-state docs**: What tells you what is done vs in-progress vs pending?
- **Architecture docs**: What explains how the system is designed?
- **Governance docs**: What rules govern how work gets merged/completed?
- **Status docs**: What shows you current operational state?

**Precedence rules**: If two docs conflict, which one wins?

**Tip**: List 3–8 docs max. If you list everything, the helper cannot prioritize.

---

### Section 3 — Roadmap / Phase Model

Define how the project sequences its work.

- **Model type**: Layers? Phases? Milestones? Sprints? Kanban?
- **Current active phase**: What are you working on now?
- **Sequencing rules**: Can you jump ahead? What must be done before X?
- **Advancement requirements**: What must be true before moving to the next phase?

**Tip**: If your project has no formal phases, just write "backlog-driven, no formal phases" and note which areas are highest priority.

---

### Section 4 — Status Surfaces

Define where current progress lives.

- **Primary current-state sources**: What docs/dashboards show you where things stand?
- **Sprint closeout source**: Where do completed sprints get closed out?
- **Backlog/findings source**: Where are open issues and findings tracked?
- **Freshness expectation**: How stale is too stale? (e.g., "within 3 days", "after every sprint")

---

### Section 5 — Truth Sources

Define what the AI operating system should treat as authoritative.

- **Repo truth sources**: Which files/directories are canonical? (e.g., `src/`, `docs/contracts/`)
- **Artifact truth sources**: Where do proofs, outputs, and audit results live?
- **Runtime/verification truth sources**: Where do test results, CI artifacts, and gate outputs appear?
- **Diagnostic surfaces**: What tools/endpoints show operational truth?

---

### Section 6 — Artifact Conventions

Define where outputs live.

- **Proof bundle path**: Where do sprint proofs go? (e.g., `out/sprints/<SPRINT>/<DATE>/proofs/`)
- **Sprint artifact path**: Where does sprint output live?
- **Durable ref docs**: What should become a doc instead of staying in chat?

---

### Section 7 — Governance / Closeout Path

Define how behavior-changing work gets closed.

- **Required closeout path**: What must happen before a sprint is done?
- **Proof requirements**: What counts as proof?
- **Verification rules**: What gates must pass?
- **Exceptions**: Any work that doesn't require this?

**Minimum**: Even if your project has no formal closeout, define "what done looks like".

---

### Section 8 — Domain-Sensitive Boundaries

Define what should not be casually generalized or mutated.

This is the most important section for preventing accidental portability of your domain logic.

List:
- Sensitive workflows (things that break silently if misunderstood)
- Business/domain logic that is local to this project
- Invariants that must never be violated
- Delivery semantics that are unique to this project
- Areas that should never be in the portable core

**Example (Unit Talk):** "pick lifecycle semantics", "Discord delivery channels", "CLV edge calculation", "single-writer constraint"

---

### Sections 9–12 — Optional (Add When Ready)

These sections provide more refinement but are not required for a first adapter:

- **Section 9**: Adapter-based helper configuration (what each helper should prioritize)
- **Section 10**: Adapter-based hook configuration (what triggers what)
- **Section 11**: Project-specific skill surface (your local-only skills)
- **Section 12**: Project-specific constraints and cautions

Add these once the base loop is working and you find yourself repeating project context in sessions.

---

## Quality Tiers

### Tier 1 — Minimum Viable Adapter

Good enough to start. Prevents gross misalignment.

Must have: Sections 1–7 filled in.

### Tier 2 — Operational Adapter

Good enough for helpers and hooks to work well.

Must have: Sections 1–9 filled in.

### Tier 3 — Production-Grade Adapter

Refined enough for robust portability and reuse.

All sections filled. Strong precedence rules. Mature boundary language.

---

## Common Mistakes to Avoid

### Mistake 1 — Copying the Unit Talk adapter
Do not take `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` and rename it. It contains Unit Talk-specific phases, docs paths, skills, and domain boundaries that have nothing to do with your project.

### Mistake 2 — Being too vague
"docs are in docs/" is not useful. "The canonical roadmap is `docs/roadmap/NEXT_5_SPRINTS.md` and the current phase doc is `docs/06_status/current_phase.md`" is useful.

### Mistake 3 — Listing everything as canonical
Not all docs are equally authoritative. Pick the 3–5 that actually govern decisions.

### Mistake 4 — Skipping the domain boundaries section
This is the most important section for preventing your project's local logic from bleeding into reusable helpers.

### Mistake 5 — Never updating it
The adapter drifts as the project evolves. Ratify it after major phase transitions.

---

## Ratification

After first use, check the adapter against live project truth:
- Is the current phase still accurate?
- Are the canonical docs still the right ones?
- Did any domain boundaries shift?

Ratify and version bump when significant drift is found.
