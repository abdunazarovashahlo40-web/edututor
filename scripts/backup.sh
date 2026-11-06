#!/usr/bin/env bash
# PostgreSQL zaxira nusxasi: ./scripts/backup.sh  → backups/edututor_YYYYmmdd_HHMM.sql.gz
# DIRECT_URL (Supabase 5432) yoki DATABASE_URL ishlatiladi. Cron: 0 3 * * * /opt/edututor/scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f backend/.env ] && set -a && . backend/.env && set +a
URL="${DIRECT_URL:-${DATABASE_URL:?DATABASE_URL kerak}}"
URL="${URL%%\?*}"
mkdir -p backups
FILE="backups/edututor_$(date +%Y%m%d_%H%M).sql.gz"
pg_dump --no-owner --no-privileges "$URL" | gzip > "$FILE"
echo "✅ Zaxira: $FILE"
# 14 kundan eski nusxalarni o'chirish
find backups -name 'edututor_*.sql.gz' -mtime +14 -delete
