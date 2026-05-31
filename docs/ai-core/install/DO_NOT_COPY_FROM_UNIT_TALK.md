# Do Not Copy These From Unit Talk

**Version:** v1 | **Date:** 2026-03-16

---

## Purpose

This document is explicit about what should NOT be copied from Unit Talk into a new project.

The risk of copying Unit Talk-specific assets into an unrelated project is real:
- You inherit betting-domain logic that has no meaning elsewhere
- Helpers and hooks start hardcoding wrong assumptions
- The project adapter becomes secretly Unit Talk-shaped
- Future diagnosis fails because the wrong skills are installed

---

## DO NOT Copy These Files

### Skills — Unit Talk-Specific

These skills are directly tied to Unit Talk's domain logic. They have no portable meaning.

| File | Why Not Portable |
|---|---|
| `.claude/skills/pick-trace.md` | Traces a pick through the `unified_picks` lifecycle. Meaningless outside Unit Talk. |
| `.claude/skills/edge-check.md` | CLV edge and model calibration for betting intelligence. Betting-domain logic. |
| `.claude/skills/grading-audit.md` | Audits the scoring/grading layer of the betting system. |
| `.claude/skills/intelligence-analysis.md` | Reviews CLV, calibration, and risk metrics for betting. |
| `.claude/skills/lifecycle-diagnose.md` | Diagnoses `unified_picks` lifecycle state transitions. |
| `.claude/skills/risk-policy.md` | Enforces Unit Talk's market-type exposure caps. |
| `.claude/skills/settlement-integrity.md` | Checks pick settlement records. Betting-settlement specific. |
| `.claude/skills/single_writer_audit.md` | Audits compliance with Unit Talk's single-writer constraint for `unified_picks`. |

**What to do instead:** Build health-check and diagnostic skills from scratch for your project, using the pattern from `pipeline-health.md` or `slo-report.md` but targeting your project's actual data sources.

---

### Application Code

Never copy Unit Talk application code into another project as a starting point.

| Module | Why Not Portable |
|---|---|
| `apps/api/src/lib/lifecycle/` | The lifecycle adapter pattern is UT-specific (unified_picks, writerRole, atomicClaimForPost). |
| `apps/api/src/agents/` | UT agents (GradingAgent, DiscordPromotionAgent, etc.) are betting-domain specific. |
| `packages/mcp-*` | MCP packages expose UT-specific truth surfaces (unified_picks, bridge_outbox, agent_health). |
| Database migrations | All migrations target UT's specific schema (unified_picks, participants, prop_settlements, etc.). |
| `CLAUDE_EXECUTION_CONTRACT.md` | Contains UT-specific single-writer rules, lifecycle adapter requirements, and table-specific policies. |

---

### Governance Contracts — Unit Talk-Specific Sections

These governance docs contain sections that are Unit Talk-specific and should not be copied verbatim:

| File | What Not To Copy |
|---|---|
| `CLAUDE.md` | Single-writer policy (§4), canonical tables (§3), lifecycle adapter examples. These are UT-specific. Copy the workflow structure (phases, proof requirements) not the content. |
| `.claude/rules/02-db-migrations.md` | References UT-specific immutability triggers and Supabase constraints. |
| `.claude/rules/03-single-writer-and-idempotency.md` | Entirely about `unified_picks` single-writer discipline. |

**What to do instead:** Create your own CLAUDE.md from scratch, referencing the pattern but using your project's actual tables, constraints, and invariants.

---

### Docs — Unit Talk-Specific Content

| File | Why Not Portable |
|---|---|
| `docs/ai/intelligence-reviews/edge-drift-review.md` | Betting CLV edge drift analysis. |
| `docs/ai/intelligence-reviews/model-calibration-check.md` | Betting model calibration for pick accuracy. |
| `docs/ai/intelligence-reviews/strategy-performance-review.md` | Betting strategy evaluation. |
| `docs/ai/AI_PROJECT_ADAPTER_UNIT_TALK_v1.md` | The Unit Talk adapter. This is the example — not the template. |
| `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` | Contains UT-specific wave completion status and UT-specific ratification items. |

---

### What To Copy From

| Asset | Source |
|---|---|
| Generic doctrine | `docs/ai-core/doctrine/AI_OPERATING_DOCTRINE_PORTABLE_v1.md` |
| Generic routing matrix | `docs/ai-core/doctrine/AI_TASK_ROUTING_MATRIX_PORTABLE_v1.md` |
| Generic handoff template | `docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md` |
| Generic preflight | `docs/ai-core/doctrine/AI_PREFLIGHT_CHECKLIST_PORTABLE_v1.md` |
| Adapter template | `docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md` |
| Bootstrap guidance | `docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md` |
| Helper/agent patterns | `docs/ai/AI_HELPER_AGENT_ARCHITECTURE_v1.md` |
| Hook patterns | `docs/ai/AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md` |
| Install guide | `docs/ai-core/install/INSTALL_GUIDE.md` |

---

## The Test

Before copying any Unit Talk asset into another repo, ask:

> "Would this make sense if the project had nothing to do with sports betting, Discord bots, or pick lifecycle management?"

If no, do not copy it.
