# SPRINT CLOSEOUT REPORT

**Sprint:** PORTABLE-CORE-EXTRACTION-059A
**Objective:** Extract the portable AI operating core from Unit Talk into a reusable starter kit
**Date:** 2026-03-16
**Status:** ✅ COMPLETE
**Lane:** Governance/Docs (Lane 4) — docs-only sprint, no code changes

---

## Executive Summary

This sprint performed a practical extraction of the reusable AI operating core from Unit Talk. The result is a concrete portable-core directory (`docs/ai-core/`) containing generic doctrine docs, an install guide, a bootstrap sequence, an adapter creation guide, and an explicit exclusion list.

The gap identified in the bootstrap readiness checklist — the missing Unit Talk adapter instance — was also filled (`docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`).

Zero Unit Talk production files were modified.

---

## What Was Delivered

### A. Extraction Summary

**Extracted (templated to portable form):**
- AI Operating Doctrine → generic version removing UT skill references and `pnpm ai:context` specifics
- Task Routing Matrix → generic version removing UT-domain rows (pick lifecycle, Discord delivery, betting intelligence)
- ChatGPT → Claude Handoff Template → cleaned of UT-specific example, generic example added
- Preflight Checklist → generic version with `[PROJECT_*]` placeholders

**Extracted (copied as-is — already portable):**
- `AI_PROJECT_ADAPTER_TEMPLATE_v1.md` (left in place, referenced from install guide)
- `AI_BOOTSTRAP_SEQUENCE_v1.md` (left in place, condensed version added)
- `AI_HELPER_AGENT_ARCHITECTURE_v1.md` (left in place, referenced)
- `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md` (left in place, referenced)
- `AI_PORTABILITY_MODEL_v1.md` (left in place — it IS the model)

**Created (new install artifacts):**
- `INSTALL_GUIDE.md` — step-by-step install for new repos
- `PROJECT_ADAPTER_CREATION_GUIDE.md` — section-by-section adapter filling guide
- `NEW_REPO_BOOTSTRAP_SEQUENCE.md` — practical condensed 7-wave bootstrap checklist
- `DO_NOT_COPY_FROM_UNIT_TALK.md` — explicit exclusion list with table and test

**Created (gap-fill):**
- `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` — the actual Unit Talk adapter instance, filling the gap noted in `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md`

**Left in place (Unit Talk-specific, do not extract):**
- All `.claude/skills/` domain skills (pick-trace, edge-check, grading-audit, intelligence-analysis, lifecycle-diagnose, risk-policy, settlement-integrity, single_writer_audit)
- All `docs/ai/intelligence-reviews/` betting intelligence procedures
- `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` (UT-specific status)
- `AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md` (UT roadmap)

**Deferred:**
- Context bundle generation script (generic version deferred to pilot)
- Generic `.claude/rules/` baseline (deferred to pilot)
- Generic bootstrap readiness checklist template (deferred)

---

## B. Classification Table

See `docs/ai-core/PORTABLE_CORE_EXTRACT.md` for the full 5-part classification table.

Summary:
- **Portable Core (high confidence):** 15 assets extracted or left in place as reusable
- **Adapter-Based:** 11 assets with clear adapter interface
- **Unit Talk-Specific:** 15 assets explicitly marked as non-portable
- **Deferred:** 4 assets pending first non-UT pilot

---

## C. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `docs/ai-core/README.md` | Created | Overview, structure map, quick classification reference |
| `docs/ai-core/PORTABLE_CORE_EXTRACT.md` | Created | Full classification table + extraction decisions |
| `docs/ai-core/SPRINT_CLOSEOUT_REPORT.md` | Created | This file |
| `docs/ai-core/doctrine/AI_OPERATING_DOCTRINE_PORTABLE_v1.md` | Created | Generic multi-AI workflow doctrine |
| `docs/ai-core/doctrine/AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md` | Created | Generic routing matrix |
| `docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md` | Created | Generic 10-field handoff template |
| `docs/ai-core/doctrine/AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md` | Created | Generic preflight checklist |
| `docs/ai-core/install/INSTALL_GUIDE.md` | Created | Step-by-step install guide for new repos |
| `docs/ai-core/install/PROJECT_ADAPTER_CREATION_GUIDE.md` | Created | Section-by-section adapter filling guide |
| `docs/ai-core/install/NEW_REPO_BOOTSTRAP_SEQUENCE.md` | Created | Practical condensed 7-wave bootstrap checklist |
| `docs/ai-core/install/DO_NOT_COPY_FROM_UNIT_TALK.md` | Created | Explicit exclusion list |
| `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` | Created | Unit Talk adapter instance (gap-fill from readiness checklist) |

Zero existing files modified.

---

## D. Portable Install Path

**Summary for future Claude work:**

To install this system in a new repo:

1. Copy 4 doctrine docs from `docs/ai-core/doctrine/` → new repo's `docs/ai/`
2. Copy `AI_PROJECT_ADAPTER_TEMPLATE_v1.md` → new repo
3. Adapt each doc (fill `[PROJECT_*]` placeholders)
4. Create a new `AI_PROJECT_ADAPTER_<NAME>_v1.md` using the template
5. Set up a ChatGPT project with project-specific system instructions
6. Create a basic context bundle generation approach
7. Run one validation sprint through the full loop

Full guidance: `docs/ai-core/install/INSTALL_GUIDE.md`

---

## E. Future-Project Usage Guidance

**What Claude should do when installing this in a new project:**

1. Read `docs/ai-core/install/NEW_REPO_BOOTSTRAP_SEQUENCE.md` as the working checklist
2. Run Bootstrap Intake (answer 7 questions about the project)
3. Copy and adapt the 4 doctrine docs — replace `[PROJECT_*]` placeholders
4. Create the adapter using `docs/ai-core/install/PROJECT_ADAPTER_CREATION_GUIDE.md`
5. Fill at minimum Sections 1–8 of the adapter
6. Check `docs/ai-core/install/DO_NOT_COPY_FROM_UNIT_TALK.md` before copying anything domain-specific

**What must be adapted vs copied:**
- Copy as-is: handoff template (works without changes)
- Light adaptation: doctrine, routing matrix, preflight (fill in `[PROJECT_*]` slots)
- Create fresh: project adapter, context bundle script, project-specific skills

---

## F. Stability Check Summary

**Unit Talk production workflows: UNAFFECTED**

Verification:
- All original `docs/ai/` files preserved (no modifications)
- All `.claude/skills/` files preserved
- All `.claude/rules/` files preserved
- All application code unmodified
- No governance contracts changed
- No sprint workflows altered
- All new content is additive (new directory and files only)

The portable core extraction created exactly 11 new files in `docs/ai-core/` and 1 new file in `docs/ai/`. Zero deletions, zero modifications to existing files.

---

## Sign-off

- [x] All planned deliverables produced
- [x] Classification table complete and grounded
- [x] Install path practical (not theoretical)
- [x] Unit Talk stability verified
- [x] Gap filled: AI_PROJECT_ADAPTER_UNIT_TALK_v1.md now exists
- [x] No Unit Talk production logic extracted or modified

**Sprint Status:** ✅ COMPLETE

---

## Recommended Next Steps

### 1. Immediately after this sprint
Update `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` to reflect:
- Unit Talk adapter now exists (gap closed)
- Portable core structure now exists in `docs/ai-core/`
- Portability readiness: **READY FOR FIRST PILOT** (pending one helper operationalization)

### 2. Is the portable core ready for a first non-Unit Talk pilot?
**Yes, with one caveat.**

The core is ready. The caveat: the portability claim will be stronger after at least one helper is operational in Unit Talk. The Prompt Composer Agent would be the highest-leverage first helper to operationalize before the pilot.

**Pilot readiness condition**: Prompt Composer Agent operational in Unit Talk → then first pilot begins.

### 3. Best pilot candidate
The best pilot is a project that:
- Has real ongoing work (pressure-tests the system)
- Is meaningfully different from Unit Talk (exposes hidden assumptions)
- Matters enough that workflow quality is worth improving

Best candidates based on current knowledge:
- **Poker project** — different domain (game theory vs sports), similar ops-heavy pattern, real work happening
- **Madden tool** — different domain (sports simulation vs live prediction), operator-tooling pattern
- **Another structured repo** — any project with a clear scope and ongoing sprints

The poker project is the strongest candidate because it has domain intelligence (hand analysis, EV, ranges) that would exercise the Intelligence Review Lane and reveal whether the adapter model works outside betting.
