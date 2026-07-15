# OmniSeller Local Verification Runbook

Use this runbook before publishing a release-candidate branch.

## Baseline

Start from the candidate checkout:

```bash
cd /home/griff843/code/OmniSeller
git status --short
```

A clean baseline has no unexplained `git status --short` output. Preserve and classify pre-existing work before editing.

## Dependencies

Install dependencies from the committed lockfile:

```bash
pnpm install --frozen-lockfile
```

## Verification

Run the standard verification command:

```bash
pnpm verify
```

`pnpm verify` runs lint, typecheck, tests, and the production build. Database validation is separate:

```bash
pnpm db:generate
pnpm db:migrate:status
```

For a migration change, deploy into an empty disposable database and recheck status before committing or pushing.

## Historical Agent-OS lane checks

Historical evidence is retained under `.agent-os/` and `.ops/`, but the Agent-OS CLI is not an OmniSeller application dependency. Install it independently before running new lanes. The local issue queue should contain only genuinely open work.

Issue queue entries must use concrete file paths. Do not use directory scopes such as
`docs/`; use the exact file that the lane may change.

README-only lane:

```json
{
  "id": "OMNI-README",
  "title": "Update README guidance",
  "status": "open",
  "labels": ["ready"],
  "tier": "T2",
  "lane_type": "hygiene",
  "file_scope": ["README.md"]
}
```

Runbook concrete-file lane:

```json
{
  "id": "OMNI-RUNBOOK",
  "title": "Update local verification runbook",
  "status": "open",
  "labels": ["ready"],
  "tier": "T2",
  "lane_type": "hygiene",
  "file_scope": ["docs/runbooks/LOCAL_VERIFICATION.md"]
}
```

Package verification lane:

```json
{
  "id": "OMNI-PACKAGE",
  "title": "Update verification scripts",
  "status": "open",
  "labels": ["ready"],
  "tier": "T2",
  "lane_type": "verification",
  "file_scope": ["package.json"]
}
```

Preserve completed lane, proof, and released lease files; reconcile stale queue entries with an additive note instead of rewriting historical proof.

## Files To Keep Out Of Commits

Do not stage `.out/`; it contains Agent-OS worktrees and is ignored by git. Stage only the intended files for the lane, such as:

- app or documentation files allowed by the lane scope
- `.agent-os/issues.json`
- `.agent-os/lanes/<ISSUE_ID>.json`
- `.agent-os/proof/<ISSUE_ID>/diff-summary.md`
- `.agent-os/proof/<ISSUE_ID>/verification.md`
- `.ops/leases/<ISSUE_ID>.json`

Before committing, confirm the staged set:

```bash
git diff --cached --stat
git status --short
```
