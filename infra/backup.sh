#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/data/plankiller.db"
BACKUP_DIR="$ROOT/backups"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB" ]]; then
  echo "Database not found: $DB" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$DB" "$BACKUP_DIR/plankiller-$STAMP.db"
echo "Backup created: $BACKUP_DIR/plankiller-$STAMP.db"
