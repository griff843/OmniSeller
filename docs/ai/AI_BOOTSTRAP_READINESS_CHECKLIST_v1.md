# AI_BOOTSTRAP_READINESS_CHECKLIST_v1

## Project
OmniSeller

## Purpose
This checklist confirms whether OmniSeller has the minimum local AI operating structure needed to begin using the portable AI workflow safely and productively.

---

## 1) Portable Core Installation Status

### Portable core docs installed
Current expected portable core surfaces:

- `docs/ai-core/`
- `docs/ai-core/doctrine/`
- `docs/ai-core/install/`

Portable core is considered installed if the shared AI-core structure exists in the repo and is being used as the reusable operating foundation.

### Status
- Portable core folder present: **Yes / No**
- Portable core doctrine docs present: **Yes / No**
- Portable core install docs present: **Yes / No**

---

## 2) Project Adapter Status

### OmniSeller adapter
Expected adapter:

- `docs/ai/AI_PROJECT_ADAPTER_OMNISELLER_v1.md`

### Status
- OmniSeller adapter exists: **Yes / No**

If yes, OmniSeller now has a local project interpretation layer so AI workflows can understand OmniSeller as a resale/inventory operations project rather than a generic app.

---

## 3) AI Workflow Readiness

### Does OmniSeller have enough docs to start using the AI workflow?
Minimum recommended starting set:

- portable core installed
- OmniSeller project adapter exists
- a basic local AI docs folder exists
- at least an initial roadmap or phase concept exists
- at least a minimal understanding of current project state exists

### Practical readiness rule
OmniSeller can begin the AI workflow once:
1. portable core is installed
2. the OmniSeller adapter exists
3. the repo has at least a minimal roadmap/status direction
4. first sprint scope is narrow and controlled

### Current assessment
Recommended status values:
- **Ready**
- **Partially Ready**
- **Not Ready**

Suggested current assessment for OmniSeller at this stage:
**Partially Ready**

Reason:
OmniSeller can begin early AI-guided setup work once portable core, adapter, and local AI planning docs are in place, even if full architecture/status/governance documentation is not finished yet.

---

## 4) What Is Still Missing Before the First Real Sprint

Likely missing items before the first real OmniSeller sprint:

- canonical OmniSeller roadmap doc
- current system status doc
- phase status doc
- next-steps doc
- architecture doc for inventory/listing lifecycle
- governance doc for truth, closeout, and proof expectations
- artifact/output conventions confirmed in repo

These do not all need to be perfect before the first sprint, but the first sprint should help establish them.

---

## 5) Recommended First Real Sprint

Recommended first OmniSeller sprint:

**Foundation Truth Sprint**

Goal:
Create the minimum OmniSeller truth surfaces required for controlled AI-assisted work.

Suggested outputs:
- `docs/omniseller/ROADMAP.md`
- `docs/omniseller/status/CURRENT_SYSTEM_STATUS.md`
- `docs/omniseller/status/PHASE_STATUS.md`
- `docs/omniseller/status/NEXT_STEPS.md`
- `docs/omniseller/architecture/OVERVIEW.md`

This gives OmniSeller a stable local truth layer before deeper implementation work begins.

---

## 6) First Helper / Skill To Operationalize

Recommended first helper:
**prompt-compose pattern for OmniSeller**

Why this should be first:
- OmniSeller will likely need clear sprint prompts before it needs deeper diagnostics
- prompt composition helps convert roadmap/status truth into high-quality implementation prompts
- it is the safest and most reusable early helper

Recommended first helper outcome:
A reusable pattern that can take:
- active phase
- current status
- scoped objective
- constraints
- proof expectations

and turn that into a clean implementation-ready handoff.

---

## 7) Short Practical Conclusion

Current OmniSeller AI operating position:

- portable core: **in progress / installed**
- OmniSeller adapter: **should exist**
- local AI operating layer: **being established**
- ready for first real sprint: **yes, once minimum truth docs are created**
- best first helper: **prompt-compose**

OmniSeller does not need full maturity yet.
It needs enough structure to begin controlled, truth-based AI workflow adoption without confusion or drift.