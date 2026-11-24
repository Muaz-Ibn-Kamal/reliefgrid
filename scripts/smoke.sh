#!/usr/bin/env bash
# Smoke test: sign in as each demo role, request every page and a few role-gated APIs, print HTTP status.
BASE=${BASE:-http://localhost:3000}; PW='ReliefGrid@2026'
declare -A USERS=([admin]=admin@reliefgrid.demo [coord]=coordinator@reliefgrid.demo [org]=org@reliefgrid.demo [vol]=volunteer@reliefgrid.demo [shelter]=shelter@reliefgrid.demo)
PAGES="/dashboard /incidents /incidents/new /requests /resources /allocations /shelters /tasks /volunteers /teams /map /reports /users /profile"
for role in admin coord org vol shelter; do
  jar=$(mktemp); code=$(curl -s -o /dev/null -w '%{http_code}' -c $jar -H 'Content-Type: application/json' -d "{\"email\":\"${USERS[$role]}\",\"password\":\"$PW\"}" $BASE/api/auth/login)
  echo "== $role login:$code"
  for p in $PAGES; do printf '%s=%s ' "$p" "$(curl -s -o /dev/null -w '%{http_code}' -b $jar $BASE$p)"; done; echo
  for a in /api/analytics/dashboard '/api/incidents?pageSize=2' '/api/requests?pageSize=2' '/api/resources?pageSize=2' '/api/shelters?pageSize=2' /api/users /api/activity '/api/export/incidents'; do printf '%s=%s ' "$a" "$(curl -s -o /dev/null -w '%{http_code}' -b $jar "$BASE$a")"; done; echo
done
echo "== anon: /dashboard=$(curl -s -o /dev/null -w '%{http_code}' $BASE/dashboard) /help=$(curl -s -o /dev/null -w '%{http_code}' $BASE/help) /api/incidents=$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/incidents)"
