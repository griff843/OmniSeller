# OMNI-106 Verification

## Worktree Checks

Command:

```bash
git diff -- README.md docs/runbooks/LOCAL_VERIFICATION.md
git status --short
pnpm verify
```

Result:

- `git diff -- README.md docs/runbooks/LOCAL_VERIFICATION.md` showed only the allowed documentation changes.
- `git status --short` showed only:
  - `README.md`
  - `docs/runbooks/LOCAL_VERIFICATION.md`
- `pnpm verify` failed in the worktree because this lane was started with `--skip-install` and the worktree does not have `node_modules`.

Failure detail:

```text
Error: Cannot find module '.../packages/db/node_modules/prisma/build/index.js'
WARN Local package.json exists, but node_modules missing, did you mean to install?
```

Per the local verification runbook, dependencies were not installed in the worktree. Verification must be run from the main checkout after copying the allowed lane results back.
