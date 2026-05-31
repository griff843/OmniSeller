# New Repo Bootstrap Sequence

**Version:** v1 | **Date:** 2026-03-16

This is the practical condensed version of the full bootstrap sequence (`docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md`). Use this as your working checklist when bootstrapping a new repo.

---

## Before You Start — Bootstrap Intake

Answer these questions first:

- [ ] What is this project? (one sentence)
- [ ] What is the main risk profile? (what mistakes are expensive)
- [ ] Is this greenfield or an existing repo?
- [ ] Does it already have canonical docs? If yes, which ones?
- [ ] Does it already have a roadmap or phase model?
- [ ] Is there already a build/test/verification path?
- [ ] What is the highest-value first sprint?

**Exit criterion**: You can answer all of the above without guessing.

---

## Wave 1 — Portable Core Foundation (Day 1)

Install the base operating layer first. No project-local complexity yet.

- [ ] Create `docs/ai/` directory
- [ ] Copy and adapt `AI_OPERATING_DOCTRINE_v1.md`
- [ ] Copy and adapt `AI_TASK_ROUTING_MATRIX_v1.md`
- [ ] Copy and adapt `CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` (minimal adaptation needed)
- [ ] Copy and adapt `AI_PREFLIGHT_CHECKLIST_v1.md`
- [ ] Create a ChatGPT project for this repo
- [ ] Set ChatGPT project instructions (replace Unit Talk identity with your project)

**Exit criterion**: The operator knows which task lane to use for any given task.

---

## Wave 2 — Project Adapter (Day 1–2)

Teach the portable core how to understand this project.

- [ ] Create `AI_PROJECT_ADAPTER_<PROJECT>_v1.md` using the template
- [ ] Fill in Sections 1–7 (minimum viable adapter):
  - [ ] Section 1: Project identity
  - [ ] Section 2: Canonical documentation map
  - [ ] Section 3: Roadmap / phase model
  - [ ] Section 4: Status surfaces
  - [ ] Section 5: Truth sources
  - [ ] Section 6: Artifact conventions
  - [ ] Section 7: Governance / closeout path
  - [ ] Section 8: Domain-sensitive boundaries
- [ ] Review the adapter against current repo truth

**Exit criterion**: A new Claude session can read the adapter and understand the project without a live briefing.

---

## Wave 3 — Truth and Status Wiring (Day 2–3)

Connect the operating system to the project's actual current-state.

- [ ] Create or identify a current-state doc (what's done, in-progress, next)
- [ ] Identify the sprint closeout source
- [ ] Identify the artifact path conventions
- [ ] Create or define a context bundle generation approach
  - At minimum: a markdown file that assembles key status docs
  - Better: a script that generates it automatically
- [ ] Reference the context bundle location in your ChatGPT project instructions

**Exit criterion**: The operator can generate a context bundle and paste it into ChatGPT to get useful architecture guidance.

---

## Wave 4 — First Operating Loop (Sprint 1)

Prove the base loop works with real work.

- [ ] Choose the first real sprint
- [ ] Fill out the preflight checklist
- [ ] Generate a context bundle
- [ ] Shape the sprint in ChatGPT
- [ ] Create the Claude Code handoff using the handoff template
- [ ] Execute implementation in Claude Code
- [ ] Run verification
- [ ] Generate proof artifacts
- [ ] Run closeout
- [ ] Update current-state docs

**Exit criterion**: One real sprint completed through the full loop with no major friction.

---

## Wave 5 — First Helpers (After Wave 4 validates)

Add the highest-value helpers once the base loop is proven.

Priority order (use as many as are useful, in this order):

1. **Prompt Composer Agent** — helps generate better Claude Code prompts
2. **Sprint Planning Agent** — helps select and sequence next sprints
3. **Status Sync / Documentation Agent** — helps update docs after closeout
4. **Incident Triage Agent** — helps structure live-system diagnosis

Each helper is defined in `docs/ai/AI_HELPER_AGENT_ARCHITECTURE_v1.md`.

**Exit criterion**: At least one helper is active and reducing friction.

---

## Wave 6 — First Hooks (After Wave 5 validates)

Add the highest-value workflow hooks.

Priority order:

1. `architecture-approved → handoff` — automatic handoff creation after ChatGPT sign-off
2. `implementation-complete → closeout` — ensures proof discipline after every sprint
3. `verification-complete → status sync` — keeps status docs current
4. `context-refresh-after-sprint-close` — keeps context bundle fresh

Each hook is defined in `docs/ai/AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`.

**Exit criterion**: At least the closeout hook is active, preventing status drift.

---

## Wave 7 — First Skills (As Project Matures)

Add project-specific skills once you have real diagnostic needs.

Start with:
- A health-check skill (what does "healthy" look like for your system?)
- An architecture-boundary-audit skill (what patterns should Claude Code follow?)

Do NOT copy Unit Talk-specific skills. Build skills from the pattern, not the content.

**Exit criterion**: At least one skill is active and used in real diagnosis.

---

## Validation Checkpoint

After Wave 4, evaluate:

- Are docs helping or creating noise?
- Is the adapter providing enough truth?
- Is handoff quality better than before?
- Is verification properly preserved?
- Are statuses being updated?
- Did any Unit Talk assumptions leak in?

Document weaknesses and file them as improvement sprints.

---

## Bootstrap Quality Tiers

| Tier | Waves Complete | Condition |
|---|---|---|
| Tier 1 — Minimal | Waves 1–4 | Early project, establish basic discipline quickly |
| Tier 2 — Operational | Waves 1–5 | Active work ongoing, coordination quality matters |
| Tier 3 — Production-grade | Waves 1–7 | Serious project requiring governance and repeatability |

---

## What Signals Bootstrap Is Complete

The bootstrap is complete (not just documented) when:

- [ ] One real sprint ran through the full loop
- [ ] The context bundle is useful to ChatGPT
- [ ] The handoff template improved prompt quality
- [ ] Claude OS closed out at least one sprint
- [ ] The project adapter reflects current reality
- [ ] Status docs were updated after closeout

**Important**: Docs existing does not mean bootstrap is complete. Real work through the loop is the test.
