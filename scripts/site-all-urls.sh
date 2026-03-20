#!/usr/bin/env bash
# All HTML routes for this site (matches vite.config.js rollup inputs).
#
# Usage:
#   ./scripts/site-all-urls.sh                    # print full URLs (default: dev server)
#   BASE_URL=https://example.com ./scripts/site-all-urls.sh
#   ./scripts/site-all-urls.sh --check            # HTTP status per URL (needs curl; site must be running)
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"

PATHS=(
  "/"
  "/pages/index.html"
  "/pages/poi-1.html"
  "/pages/poi-2.html"
  "/pages/poi-3.html"
  "/pages/poi-4.html"
  "/pages/poi-5.html"
  "/pages/poi-6.html"
  "/pages/live-feed.html"
  "/pages/summary.html"
  "/pages/sources.html"
  "/pages/terms.html"
)

CHECK=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK=true
fi

if $CHECK; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl is required for --check" >&2
    exit 1
  fi
  echo "Checking ${#PATHS[@]} URLs under ${BASE_URL}"
  ok=0
  fail=0
  for p in "${PATHS[@]}"; do
    url="${BASE_URL}${p}"
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
    if [[ "$code" =~ ^2[0-9]{2}$ ]] || [[ "$code" == "304" ]]; then
      echo "  OK ${code}  ${url}"
      ok=$((ok + 1))
    else
      echo "  FAIL ${code}  ${url}" >&2
      fail=$((fail + 1))
    fi
  done
  echo "Done: ${ok} ok, ${fail} failed"
  [[ "$fail" -eq 0 ]]
else
  for p in "${PATHS[@]}"; do
    echo "${BASE_URL}${p}"
  done
fi
