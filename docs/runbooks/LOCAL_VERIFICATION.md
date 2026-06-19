# OmniSeller Local Verification Runbook

Use this runbook before closing local Agent-OS lanes or publishing changes from `main`.

## Baseline

Start from the main checkout:

```bash
cd /home/griff843/code/OmniSeller
git status --short
pnpm exec agent-os doctor --strict
pnpm exec agent-os board
```

A clean baseline has no `git status --short` output and `agent-os board` reports `active_lanes: 0`.

## Dependencies

Install dependencies only in the main checkout when they are missing or intentionally refreshed:

```bash
pnpm install
```

Agent-OS worktrees may be created with `--skip-install`. In that case, `pnpm verify` can fail inside the worktree because `node_modules` is absent. Copy the lane result back to main and run verification from the main checkout before committing.

## Verification

Run the standard verification command:

```bash
pnpm verify
```

`pnpm verify` runs `pnpm build`. If you need to confirm the underlying build directly, run:

```bash
pnpm build
```

Both commands should pass from main before committing or pushing.

## Agent-OS Lane Checks

Use the local issue queue at `.agent-os/issues.json`, run a dry-run first, then execute one lane:

```bash
pnpm exec agent-os loop --dry-run --issues-file .agent-os/issues.json --label ready
pnpm exec agent-os loop --execute --issues-file .agent-os/issues.json --label ready --limit 1 --skip-install
```

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

After copying lane results back to main, close the lane and confirm the board is clear:

```bash
pnpm exec agent-os lane close --issue <ISSUE_ID> --reason complete
pnpm exec agent-os board
```

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
