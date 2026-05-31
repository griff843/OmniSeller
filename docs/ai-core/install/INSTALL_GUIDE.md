# AI Portable Core — Install Guide

**Version:** v1 | **Date:** 2026-03-16
**Source:** Unit Talk AI Operating System

---

## What This Installs

A multi-AI operating system that governs how work flows through ChatGPT, Claude Code, Claude OS, and project-specific skills/tools.

**Result:** A governed, repeatable workflow with clear routing, handoff standards, proof discipline, and closeout rigor.

---

## Prerequisites

Before installing, the target project should have:
- a git repository
- an existing codebase or clear scope
- at least one person who will maintain the AI operating layer
- a basic understanding of what Claude Code and ChatGPT are

The AI operating system does NOT require:
- Supabase
- Temporal
- any specific tech stack
- any existing documentation (the install creates it)

---

## Install Steps

### Step 1 — Create the docs/ai/ directory

```bash
mkdir -p docs/ai/prompt-templates
```

This is where AI operating system docs will live.

### Step 2 — Copy the portable doctrine docs

Copy from `docs/ai-core/doctrine/` into `docs/ai/` in your new repo:

| File to copy | Target name |
|---|---|
| `AI_OPERATING_DOCTRINE_PORTABLE_v1.md` | `AI_OPERATING_DOCTRINE_v1.md` |
| `AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md` | `AI_TASK_ROUTING_MATRIX_v1.md` |
| `CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md` | `CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` |
| `AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md` | `AI_PREFLIGHT_CHECKLIST_v1.md` |

### Step 3 — Copy the adapter template

Copy:
```
docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md
→ [new-repo]/docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md
```

Then **create your adapter** (see `PROJECT_ADAPTER_CREATION_GUIDE.md`).

### Step 4 — Copy supporting architecture docs (optional but recommended)

These docs contain the full rationale and are useful context when building helpers and hooks:

| File | What it explains |
|---|---|
| `docs/ai/AI_PORTABILITY_MODEL_v1.md` | The three-layer portability architecture |
| `docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md` | The 7-phase bootstrap sequence |
| `docs/ai/AI_HELPER_AGENT_ARCHITECTURE_v1.md` | How to design reusable helpers/agents |
| `docs/ai/AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md` | How to design workflow automation hooks |

### Step 5 — Adapt the doctrine docs

In each copied doc, fill in the `[PROJECT_*]` placeholders:

| Placeholder | Replace with |
|---|---|
| `[PROJECT_DOC_ROOT]` | Path to your AI docs (e.g., `docs/ai`) |
| `[project]:context` | Your context bundle generation command |
| `[project-skill-*]` | Your project's actual diagnostic skills |
| `[PROJECT_STATUS_DOC]` | Your current-state doc (e.g., `docs/status/CURRENT_STATE.md`) |
| `[PROJECT_PHASE_DOC]` | Your roadmap/phase doc |
| `[PROJECT_CONSTRAINT_*]` | Your project's hard invariants |
| `[PROJECT_GOVERNANCE_CONTRACT]` | Your governance contract file |
| `[PROJECT_EXECUTION_CONTRACT]` | Your execution contract file |
| `[PROJECT_SPRINT_QUEUE_DOC]` | Your sprint queue doc |

### Step 6 — Create the project adapter

Fill in `AI_PROJECT_ADAPTER_<YOUR_PROJECT>_v1.md` using the template.

See: `install/PROJECT_ADAPTER_CREATION_GUIDE.md`

### Step 7 — Create a ChatGPT project

Follow `AI_PROJECT_SETUP_CHECKLIST_v1.md` to set up the ChatGPT project.

Key steps:
- Create a ChatGPT Project for this repo
- Set the system instructions (replace Unit Talk identity with your project)
- Set context bundle + handoff template as default workflow

### Step 8 — Create a context bundle generation script

Your project needs a way to generate a context bundle for ChatGPT.

At minimum this should export:
- current system/phase status
- recent sprint history
- key architectural decisions
- current drift/findings
- active sprint queue

This can be as simple as a bash script that assembles key docs into one markdown file, or a Node.js script like Unit Talk's `scripts/ai/build-context-bundle.mjs`.

### Step 9 — Create the .claude directory

```bash
mkdir -p .claude/skills
mkdir -p .claude/rules
mkdir -p .claude/agents
```

Add a minimal `CLAUDE.md` at the repo root that explains the project and references the docs you just created.

### Step 10 — Run one validation sprint

The install is not complete until at least one real sprint has used the system.

Run through:
```
Plan → Implement → Verify → Proof → Closeout
```

Evaluate:
- Did the doctrine help route the task correctly?
- Did the handoff template improve the prompt quality?
- Did the preflight catch anything?
- Did Claude OS closeout work?

Document any gaps and fix them.

---

## Minimum Viable Install

If you cannot do the full install immediately, the minimum useful set is:

1. `AI_OPERATING_DOCTRINE_v1.md` (adapted)
2. `CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` (adapted — generic example already works)
3. A project adapter with at least:
   - project identity
   - 3–5 canonical docs
   - current active phase
   - closeout path

This minimum set alone will immediately improve:
- tool routing decisions
- implementation prompt quality
- handoff clarity

Add more as the project matures.

---

## What NOT to Copy

See `install/DO_NOT_COPY_FROM_UNIT_TALK.md` for the explicit exclusion list.

The short version:
- Do not copy pick-trace, edge-check, discord-diagnose, scoring-audit
- Do not copy lifecycle adapter code or single-writer gate
- Do not copy the Unit Talk adapter instance and rename it
- Do not copy betting-domain invariants, CLV logic, or settlement checks

---

## Next Steps After Install

1. Create and fill the project adapter
2. Wire your project's status/truth sources into the adapter
3. Create a context bundle generation script
4. Enable the first helpers (Prompt Composer Agent is the highest-leverage starting point)
5. Define the first 2–3 workflow hooks
6. Run the validation sprint

---

## Reference Docs

| Doc | Purpose |
|---|---|
| `docs/ai-core/install/PROJECT_ADAPTER_CREATION_GUIDE.md` | How to fill the project adapter |
| `docs/ai-core/install/NEW_REPO_BOOTSTRAP_SEQUENCE.md` | Condensed step-by-step bootstrap |
| `docs/ai-core/install/DO_NOT_COPY_FROM_UNIT_TALK.md` | Explicit exclusion list |
| `docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md` | The adapter template |
| `docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md` | Full 7-phase bootstrap sequence |
| `docs/ai/AI_HELPER_AGENT_ARCHITECTURE_v1.md` | Helper/agent design patterns |
| `docs/ai/AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md` | Hook/automation design patterns |
