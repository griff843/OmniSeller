# Portable Core Extraction — Classification Table

**Sprint:** PORTABLE-CORE-EXTRACTION-059A
**Date:** 2026-03-16
**Author:** Claude / Griff

---

## Purpose

This document records the explicit extraction decision for every AI operating-system asset in Unit Talk.

For each asset it records:
- Classification (Portable Core / Adapter-Based / Unit Talk-Specific / Deferred)
- Action taken
- Rationale

This is the ground truth for why each asset ended up where it did.

---

## Part 1 — Governance and Workflow Docs

| Asset | File | Classification | Action | Rationale |
|---|---|---|---|---|
| AI Operating Doctrine | `docs/ai/AI_OPERATING_DOCTRINE_v1.md` | **Portable Core** | Templated → `docs/ai-core/doctrine/AI_OPERATING_DOCTRINE_PORTABLE_v1.md` | Multi-AI routing model is project-agnostic. UT-specific skill names and `pnpm ai:context` paths removed. Generic skill slot added. |
| Task Routing Matrix | `docs/ai/AI_TASK_ROUTING_MATRIX_v1.md` | **Portable Core** | Templated → `docs/ai-core/doctrine/AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md` | Routing logic is universal. UT-specific rows (pick lifecycle, Discord delivery, betting intelligence) removed. Generic equivalents added as project-fillable slots. |
| Preflight Checklist | `docs/ai/AI_PREFLIGHT_CHECKLIST_v1.md` | **Portable Core** | Templated → `docs/ai-core/doctrine/AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md` | Five preflight questions are universal. UT-specific skill invocations replaced with `[project-skill]` placeholders. UT doc paths replaced with generic equivalents. |
| ChatGPT → Claude Handoff Template | `docs/ai/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_v1.md` | **Portable Core** | Templated → `docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md` | 10-field handoff structure is completely project-agnostic. UT-specific example replaced with generic slot. |
| Project Setup Checklist | `docs/ai/AI_PROJECT_SETUP_CHECKLIST_v1.md` | **Portable Core** | Referenced in install guide (not copied — already nearly generic) | ChatGPT project setup steps apply to any project. Only UT-specific identity section needs replacing. |
| LLM Decision Playbook | `docs/ai/LLM_DECISION_PLAYBOOK.md` | **Portable Core** | Referenced + noted in install guide as adaptation target | Core model-routing decisions (Haiku/Sonnet/Opus selection, ChatGPT role) are fully portable. UT-specific skill table replaced per-project. |
| Universal AI Kit Plan | `docs/ai/UNIVERSAL_AI_KIT_PLAN_v1.md` | **Portable Core** | Left in place — it IS the planning doc for this effort | Meta-planning doc for portability; remains as canonical intent doc |
| AI Enhancement Remaining Work Map | `docs/ai/AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md` | **Adapter-Based** | Left in place — it's a UT status doc, not a template | Contents are UT-specific work items. Pattern of "remaining work map" is reusable as a template but content is local. |
| AI Skill Wave 2 Plan | `docs/ai/AI_SKILL_WAVE_2_PLAN_v1.md` | **Adapter-Based** | Left in place | Skill planning pattern is reusable. Specific skills are mixed (some portable, some UT-only). New projects should create their own wave plan. |
| AI Helper Agent Architecture | `docs/ai/AI_HELPER_AGENT_ARCHITECTURE_v1.md` | **Portable Core** | Left in place + referenced from install guide | Helper/agent patterns are fully reusable. Doc is already generic enough to serve directly. |
| AI Hook Automation Architecture | `docs/ai/AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md` | **Portable Core** | Left in place + referenced from install guide | Hook patterns are reusable. Doc references some UT-specific triggers but the architecture is generic. |
| AI Portability Model | `docs/ai/AI_PORTABILITY_MODEL_v1.md` | **Portable Core** | Left in place (it IS the portability model) | Meta-architecture doc for portability. Remains canonical. |
| AI Portable Core Inventory | `docs/ai/AI_PORTABLE_CORE_INVENTORY_v1.md` | **Portable Core** | Left in place | The formal inventory doc. This extraction sprint is the operationalization of it. |
| AI Project Adapter Template | `docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md` | **Portable Core** | Left in place + referenced from install guide | The template itself is the portable artifact. Per-project instances get created from it. |
| AI Bootstrap Sequence | `docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md` | **Portable Core** | Left in place + condensed version in install/NEW_REPO_BOOTSTRAP_SEQUENCE.md | 7-phase sequence is universal. Condensed version added for practical use. |
| AI Bootstrap Readiness Checklist | `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` | **Adapter-Based** | Left in place | Contents are UT-specific (Wave 2 completion status, UT adapter ratification etc). Pattern is reusable — new projects should create their own instance. |
| Prompt Templates (4 files) | `docs/ai/prompt-templates/*.md` | **Adapter-Based** | Left in place | Template structure is portable. Contents reference UT context bundle format. New projects should adapt them to their context bundle format. |
| Intelligence Review Procedures | `docs/ai/intelligence-reviews/*.md` | **Unit Talk-Specific** | Left in place | CLV/calibration/strategy review content is betting-domain specific. Pattern of "intelligence review procedures" is reusable but content is not. |

---

## Part 2 — Skills

| Asset | File | Classification | Action | Rationale |
|---|---|---|---|---|
| sprint_plan | `.claude/skills/sprint_plan.md` | **Adapter-Based** | Left in place. Referenced as "adapt for your project" | Contains UT-specific checks (unified_picks, lifecycle adapter). Core sprint plan pattern is reusable. |
| sprint_implement | `.claude/skills/sprint_implement.md` | **Adapter-Based** | Left in place | Core implementation discipline is portable. UT-specific gate checks need replacing per project. |
| sprint_verify | `.claude/skills/sprint_verify.md` | **Adapter-Based** | Left in place | Verification discipline is portable. Specific gates (lifecycle:single-writer, type-check commands) vary by project. |
| sprint_proof_bundle | `.claude/skills/sprint_proof_bundle.md` | **Portable Core** | Left in place. Referenced as strong starting point | Proof discipline pattern is universal. Specific artifact paths would adapt. |
| pipeline-health | `.claude/skills/pipeline-health.md` | **Adapter-Based** | Left in place | Health-check skill pattern is reusable. MCP tool names, field names, alert thresholds are UT-specific. New projects create their own health skill. |
| slo-report | `.claude/skills/slo-report.md` | **Adapter-Based** | Left in place | SLO reporting pattern is reusable. SLO definitions and thresholds are project-specific. |
| pick-trace | `.claude/skills/pick-trace.md` | **Unit Talk-Specific** | Left in place — do not copy | Directly tied to unified_picks lifecycle. No portable equivalent. |
| edge-check | `.claude/skills/edge-check.md` | **Unit Talk-Specific** | Left in place — do not copy | Betting-domain CLV logic. No portable equivalent. |
| grading-audit | `.claude/skills/grading-audit.md` | **Unit Talk-Specific** | Left in place — do not copy | Betting scoring/grading logic. |
| intelligence-analysis | `.claude/skills/intelligence-analysis.md` | **Unit Talk-Specific** | Left in place — do not copy | Betting intelligence framework. |
| lifecycle-diagnose | `.claude/skills/lifecycle-diagnose.md` | **Unit Talk-Specific** | Left in place — do not copy | unified_picks lifecycle specific. |
| risk-policy | `.claude/skills/risk-policy.md` | **Unit Talk-Specific** | Left in place — do not copy | Betting risk/cap logic. |
| settlement-integrity | `.claude/skills/settlement-integrity.md` | **Unit Talk-Specific** | Left in place — do not copy | Betting settlement logic. |
| single_writer_audit | `.claude/skills/single_writer_audit.md` | **Unit Talk-Specific** | Left in place — do not copy | unified_picks single-writer contract. |
| e2e_smoke_check | `.claude/skills/e2e_smoke_check.md` | **Adapter-Based** | Left in place | E2E check pattern is reusable. Specific endpoints/flows vary by project. |
| migration_review | `.claude/skills/migration_review.md` | **Adapter-Based** | Left in place | Migration review discipline is reusable. UT-specific immutability triggers are local. |

---

## Part 3 — Helper/Agent Patterns

| Asset | Classification | Action | Rationale |
|---|---|---|---|
| Prompt Composer Agent | **Portable Core** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md — referenced from install guide | Highest-value portable helper. Improves handoff quality on any project. |
| Sprint Planning Agent | **Adapter-Based** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md | Pattern reusable; roadmap/status inputs vary by project. |
| Status Sync / Documentation Agent | **Portable Core** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md — referenced from install guide | Anti-drift pattern. Broadly valuable. |
| Incident Triage Agent | **Portable Core** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md | Core triage pattern is universal. Evidence sources adapt. |
| Architecture Audit Agent | **Portable Core** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md | Strong universal architecture review role. |
| Project Bootstrap Agent | **Portable Core** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md | Cross-project by design. |
| Intelligence Review Agent | **Adapter-Based** | Defined in AI_HELPER_AGENT_ARCHITECTURE_v1.md | Pattern reusable; domain subject varies heavily. |

---

## Part 4 — Hook/Automation Patterns

| Asset | Classification | Action | Rationale |
|---|---|---|---|
| architecture-approved → claude handoff | **Portable Core** | Defined in AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md | One of the strongest reusable operating hooks. |
| implementation-complete → governance closeout | **Portable Core** | Defined | Core proof discipline hook. |
| verification-complete → status sync | **Portable Core** | Defined | Anti-drift hook. Universal value. |
| context-refresh-after-sprint-close | **Portable Core** | Defined | General workflow hygiene. |
| behavior-changing-work → closeout path | **Portable Core** | Defined | Governance rigor hook. |
| diagnosis-request → skill-first path | **Portable Core** | Defined | Universal routing discipline. |
| discord-issue → discord-diagnose | **Unit Talk-Specific** | Left local | Tied to UT Discord skill. |
| scoring-review → scoring-audit | **Unit Talk-Specific** | Left local | Tied to UT betting domain. |
| phase-sensitive-work → roadmap-check | **Adapter-Based** | Defined | Pattern reusable; phase model varies. |
| sprint-output → artifact-location | **Adapter-Based** | Defined | Pattern reusable; paths vary by repo. |

---

## Part 5 — What Was Created in This Sprint

| File Created | Purpose |
|---|---|
| `docs/ai-core/README.md` | Overview, structure map, quick reference |
| `docs/ai-core/PORTABLE_CORE_EXTRACT.md` | This file — extraction decisions |
| `docs/ai-core/doctrine/AI_OPERATING_DOCTRINE_PORTABLE_v1.md` | Generic doctrine |
| `docs/ai-core/doctrine/AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md` | Generic routing matrix |
| `docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md` | Generic handoff template |
| `docs/ai-core/doctrine/AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md` | Generic preflight |
| `docs/ai-core/install/INSTALL_GUIDE.md` | Step-by-step install for new repos |
| `docs/ai-core/install/PROJECT_ADAPTER_CREATION_GUIDE.md` | How to create a project adapter |
| `docs/ai-core/install/NEW_REPO_BOOTSTRAP_SEQUENCE.md` | Practical condensed bootstrap |
| `docs/ai-core/install/DO_NOT_COPY_FROM_UNIT_TALK.md` | Explicit exclusion list |
| `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` | Unit Talk adapter instance (fills the gap identified in readiness checklist) |

---

## Part 6 — What Was Deferred

| Asset | Reason |
|---|---|
| AI_BOOTSTRAP_READINESS_CHECKLIST template | Current UT instance is too status-specific. Template version deferred until first non-UT pilot reveals what's truly reusable. |
| Context bundle generation scripts | UT's `pnpm ai:context` / `build-context-bundle.mjs` is UT-specific in implementation. Pattern is portable but extraction requires real pilot project. |
| Generic health-check skill template | Pattern is clear, but building a proper generic version requires knowing what MCP tools exist in target project. Deferred to pilot. |
| Generic sprint workflow .claude/rules/ | The `.claude/rules/` directory contains UT-specific governance rules (single-writer, lifecycle, migration). A generic baseline rules set is a good future artifact but requires a pilot to test against. |

---

## Part 7 — Stability Verification

The following Unit Talk production assets were **NOT modified** in this sprint:

- All files in `docs/ai/` (original copies preserved)
- All files in `.claude/skills/` (no changes)
- All files in `.claude/rules/` (no changes)
- All files in `.claude/agents/` (no changes)
- All application code (`apps/`, `packages/`)
- All governance contracts (`CLAUDE.md`, `CLAUDE_EXECUTION_CONTRACT.md`)

This sprint created new files only. Zero risk to Unit Talk production workflows.
