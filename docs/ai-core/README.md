# AI Portable Core

**Status:** v1 — Extracted 2026-03-16
**Source:** Unit Talk AI Operating System
**Owner:** Griff

---

## What This Is

This directory contains the **portable AI operating core** — the reusable parts of the Unit Talk AI workflow system that can be installed into any future project.

It is the result of a deliberate extraction sprint that separated:
- what is truly reusable across projects
- what requires project-specific adaptation
- what must remain Unit Talk-specific

---

## Three-Layer Architecture

Every AI operating system built from this core has three layers:

```
Portable Core          ← this directory
  +
Project Adapter        ← created per-project (AI_PROJECT_ADAPTER_<NAME>_v1.md)
  +
Project-Specific       ← skills, domain logic, invariants unique to that project
Domain Layer
```

The portable core provides workflow discipline. The adapter teaches the core how to interpret a specific project. The domain layer holds the local logic that belongs nowhere else.

---

## Directory Structure

```
docs/ai-core/
├── README.md                                         ← you are here
├── PORTABLE_CORE_EXTRACT.md                          ← classification table + extraction decisions
├── doctrine/
│   ├── AI_OPERATING_DOCTRINE_PORTABLE_v1.md          ← generic multi-AI workflow doctrine
│   ├── AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md         ← quick-reference routing table
│   ├── CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md ← 10-field handoff template
│   └── AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md         ← pre-task quality gate
└── install/
    ├── INSTALL_GUIDE.md                              ← step-by-step install for new repos
    ├── PROJECT_ADAPTER_CREATION_GUIDE.md             ← how to create the project adapter
    ├── NEW_REPO_BOOTSTRAP_SEQUENCE.md                ← practical condensed bootstrap steps
    └── DO_NOT_COPY_FROM_UNIT_TALK.md                 ← explicit exclusion list
```

The full **adapter template** lives at:
- `docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md`

The **Unit Talk adapter instance** lives at:
- `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`

---

## What Is Portable (Quick Reference)

| Asset | Classification |
|---|---|
| AI Operating Doctrine | **Portable Core** |
| Task Routing Matrix | **Portable Core** |
| Preflight Checklist | **Portable Core** |
| ChatGPT → Claude Handoff Template | **Portable Core** |
| Project Setup Checklist pattern | **Portable Core** |
| LLM Decision Playbook pattern | **Portable Core** |
| Bootstrap sequence | **Portable Core** |
| Proof/artifact discipline pattern | **Portable Core** |
| Helper/agent contract patterns | **Portable Core** |
| Hook/automation contract patterns | **Portable Core** |
| Context bundle pattern | **Adapter-Based** |
| Health-check skills (pattern) | **Adapter-Based** |
| Sprint planning pattern | **Adapter-Based** |
| SLO report pattern | **Adapter-Based** |
| Agent-health pattern | **Adapter-Based** |
| Pick-trace skill | **Unit Talk-Specific** |
| Edge-check skill | **Unit Talk-Specific** |
| Discord-diagnose skill | **Unit Talk-Specific** |
| Single-writer gate | **Unit Talk-Specific** |
| Lifecycle adapter pattern | **Unit Talk-Specific** |
| Betting intelligence review prompts | **Unit Talk-Specific** |

Full classification table: `PORTABLE_CORE_EXTRACT.md`

---

## How to Use This in a New Project

**Start here:** `install/INSTALL_GUIDE.md`

The install sequence is:
1. Copy the doctrine docs into your new repo's `docs/ai/` directory
2. Create a project adapter from the template
3. Wire project-specific truth sources
4. Enable the base Plan → Implement → Verify → Closeout loop
5. Add project-specific skills only after the base is working

**Do not** copy Unit Talk domain logic. See `install/DO_NOT_COPY_FROM_UNIT_TALK.md`.

---

## Unit Talk Stability Note

This directory is an **extraction**, not a replacement.

All original Unit Talk docs remain in place at `docs/ai/`. Nothing here modifies or removes Unit Talk's active AI operating system. The portable core was created by generalizing the Unit Talk system — the Unit Talk instance remains the primary example of how this system is used in production.
