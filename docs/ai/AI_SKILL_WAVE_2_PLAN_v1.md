# AI_SKILL_WAVE_2_PLAN_v1

## Project
OmniSeller

## Purpose
This document outlines the likely second-wave AI helpers and skill patterns OmniSeller will need as the project matures.

This is not a build document.
It is an early operating roadmap for future AI workflow support inside OmniSeller.

---

## 1) Skill Wave Intent

OmniSeller will likely need lightweight AI helpers before it needs a large skill system.

The goal of Wave 2 is to identify the first reusable patterns that will help OmniSeller:
- stay organized
- generate clean prompts
- diagnose issues faster
- support resale and inventory workflows without mixing domain truth with portable-core logic

Wave 2 should focus on practical operational helpers, not heavy automation.

---

## 2) agent-health Pattern for OmniSeller

### Purpose
Provide a simple pattern for checking whether OmniSeller’s important operating surfaces are healthy.

### Likely future use
This pattern may later help answer questions like:
- are inventory flows working
- are listing workflows blocked
- are sync surfaces behaving correctly
- are reporting surfaces stale
- are key docs/status surfaces missing or out of date

### What it may eventually inspect
- repo truth surfaces
- current status docs
- key workflow outputs
- integration or sync logs
- diagnostics artifacts
- build/typecheck/test health if applicable

### Early design note
For OmniSeller, “agent-health” should not assume autonomous agents.
It should be interpreted more broadly as **operating-surface health** until OmniSeller actually has agent-based workflows.

---

## 3) prompt-compose Pattern for OmniSeller

### Purpose
Provide a repeatable way to generate high-quality implementation or planning prompts from OmniSeller truth surfaces.

### Why this matters early
OmniSeller will likely benefit from this sooner than any other helper because:
- roadmap and status docs will guide most work
- implementation prompts need to stay aligned with project truth
- this reduces drift and vague sprint requests

### Likely inputs
- active phase
- current system status
- scoped task
- constraints
- relevant docs
- proof expectations
- domain boundaries

### Likely outputs
- implementation prompt
- architecture prompt
- review prompt
- closeout verification prompt

### Recommended priority
**Highest priority future helper**

---

## 4) incident-triage Pattern for OmniSeller

### Purpose
Provide a structured way to diagnose problems when OmniSeller behavior is wrong, stale, inconsistent, or blocked.

### Likely future use
This pattern may later help triage issues such as:
- item status mismatch
- listing state drift
- sync/import failures
- duplicate inventory records
- stale dashboard/report outputs
- pricing or fulfillment workflow inconsistencies

### Core idea
The pattern should guide diagnosis through:
1. expected behavior
2. current observed behavior
3. source-of-truth surface
4. likely failure boundary
5. proof required to confirm the issue
6. recommended next action

### Early design note
OmniSeller incident triage should stay grounded in operational truth:
inventory truth, listing truth, order truth, sync truth, and status-doc truth.

---

## 5) OmniSeller-Specific Future Skill Ideas

These are future ideas only.
They are not approved builds yet.

### Inventory Reconciliation Helper
Could help compare:
- expected inventory state
- actual stored inventory state
- sold/listed/held discrepancies
- missing required metadata

### Listing Readiness Helper
Could help determine whether an item is actually ready to publish by checking:
- required fields
- condition notes
- pricing present
- photos/assets present
- marketplace-specific requirements

### Marketplace Drift Checker
Could help identify when local OmniSeller truth and marketplace truth have diverged.

### Catalog Normalization Helper
Could help standardize titles, categories, attributes, and item metadata across inventory records.

### Profit / Margin Audit Helper
Could help validate margin assumptions, fees, shipping cost treatment, and realized profit logic.

### Intake QA Helper
Could help validate new inventory records before they move deeper into the workflow.

---

## 6) Operating Boundaries for Future Skills

Future OmniSeller skills must follow these rules:

- portable core patterns can guide structure
- OmniSeller-specific logic must remain local to OmniSeller
- helpers must not flatten domain truth into generic templates
- inventory, listing, sales, fulfillment, and marketplace rules are project-local
- every future helper should declare its truth inputs and expected outputs clearly

---

## 7) Suggested Order of Future Operationalization

Recommended early order:

1. **prompt-compose**
2. **incident-triage**
3. **agent-health**
4. **listing-readiness**
5. **inventory-reconciliation**

This order gives OmniSeller the most practical early leverage.

---

## 8) Short Practical Conclusion

OmniSeller’s likely Wave 2 path is:

- first, improve prompt quality
- next, improve issue diagnosis
- then, add operating-surface health checks
- after that, introduce domain-specific helpers for inventory and listings

This keeps the AI layer useful, controlled, and aligned with OmniSeller’s actual operating needs.