#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to the disposable restore target}"
: "${OMNISELLER_CONFIRM_RESTORE:?Set OMNISELLER_CONFIRM_RESTORE=disposable-target}"
if [[ "$OMNISELLER_CONFIRM_RESTORE" != "disposable-target" ]]; then
  echo "Refusing restore: confirmation must equal disposable-target" >&2
  exit 64
fi
backup="${1:?backup file is required}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$backup"
pnpm db:migrate:status
