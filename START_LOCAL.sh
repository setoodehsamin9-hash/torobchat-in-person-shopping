#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo 'Node.js 22+ is required.' >&2; exit 1
fi
APP_PROFILE="${1:-optimized}"
case "$APP_PROFILE" in optimized|boxapi) ;; *) echo 'Usage: bash START_LOCAL.sh [optimized|boxapi]' >&2; exit 1 ;; esac
APP_BUILD_DIR=$(node -e 'const fs=require("node:fs"),{parseEnv}=require("node:util");const profile=process.argv[1],file=profile==="boxapi"?".env.boxapi.local":".env.local";const local=fs.existsSync(file)?parseEnv(fs.readFileSync(file,"utf8")):{};console.log(process.env.NEXT_BUILD_DIR||local.NEXT_BUILD_DIR||`.next-${profile}`)' "$APP_PROFILE")
if [[ ! -f "$APP_BUILD_DIR/BUILD_ID" ]]; then node scripts/run-profile.mjs "$APP_PROFILE" build; fi
exec node scripts/run-profile.mjs "$APP_PROFILE" start
