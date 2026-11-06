#!/usr/bin/env bash
# Tiklash: ./scripts/restore.sh backups/edututor_20261106_0300.sql.gz
# DIQQAT: joriy ma'lumotlar ustidan yoziladi!
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?Fayl ko'rsating}"
[ -f backend/.env ] && set -a && . backend/.env && set +a
URL="${DIRECT_URL:-${DATABASE_URL:?DATABASE_URL kerak}}"
URL="${URL%%\?*}"
read -r -p "Bazaga $FILE tiklansinmi? (yes/no) " ok
[ "$ok" = "yes" ] || exit 1
gunzip -c "$FILE" | psql "$URL" -v ON_ERROR_STOP=1
echo "✅ Tiklandi"
