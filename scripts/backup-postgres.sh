#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
destination="${1:-omniseller-$(date -u +%Y%m%dT%H%M%SZ).dump}"
pg_dump --format=custom --no-owner --no-acl --file="$destination" "$DATABASE_URL"
pg_restore --list "$destination" >/dev/null
echo "Verified backup: $destination"
