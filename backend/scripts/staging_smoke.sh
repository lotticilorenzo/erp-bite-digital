#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
FRONTEND_ORIGIN="${2:-}"
ADMIN_EMAIL="${3:-}"
ADMIN_PASSWORD="${4:-}"

if [[ -z "$BASE_URL" || -z "$FRONTEND_ORIGIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Uso: scripts/staging_smoke.sh <BASE_URL> <FRONTEND_ORIGIN> <ADMIN_EMAIL> <ADMIN_PASSWORD>"
  echo "Esempio: scripts/staging_smoke.sh https://api.example.com https://app.example.com admin@bite.com 'Secret123!'"
  exit 1
fi

echo "== health =="
curl -fsS -i "${BASE_URL}/health" | sed -n '1,12p'

echo
echo "== docs =="
curl -fsS -i "${BASE_URL}/docs" | sed -n '1,12p'

echo
echo "== cors preflight =="
curl -fsS -i -X OPTIONS "${BASE_URL}/api/v1/auth/login" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" | sed -n '1,24p'

echo
echo "== login =="
curl -fsS -i -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" | sed -n '1,28p'
