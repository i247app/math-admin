#!/usr/bin/env bash
# deploy/deploy.sh — publish the built SPA (dist/) to the EC2 host that runs math-svr.
#
#   make deploy [RHOST=t1|t2|t3|t4]   build, then deploy
#   ./deploy/deploy.sh [t1|t2|t3|t4]  deploy the dist/ already built
#
# nginx on the host serves the numi.asia landing page from /apps/www/numi/html and
# proxies /go/ to math-svr (/etc/nginx/sites-available/numi.asia). The admin lives
# next to it in /apps/www/numi/admin, is built with base /admin/ and calls the API
# at /go. nginx maps /admin/ to that folder with deploy/nginx-admin.conf.
#
# Credentials come from .env.ec2-credentials, the same format as math-svr's:
# SSH_KEY, USER, and HOST (or HOST1..HOST4, picked by t1..t4).
set -euo pipefail

cd "$(dirname "$0")/.."

CRED_FILE=".env.ec2-credentials"
DEST_DIR="/apps/www/numi/admin"
PUBLIC_URL="https://numi.asia/admin"

info()  { echo "==> $*"; }
warn()  { echo "WARN  $*" >&2; }
fatal() { echo "ERROR $*" >&2; exit 1; }

# ── Credentials ──────────────────────────────────────────

[[ -f "$CRED_FILE" ]] || fatal "$CRED_FILE not found (see .env.ec2-credentials.example)"

# Exact key match, so HOST does not pick up HOST1; values may contain '='.
cred() { awk -v k="$1" 'index($0, k "=") == 1 { print substr($0, length(k) + 2); exit }' "$CRED_FILE" | tr -d '\r'; }

case "${1:-}" in
  t1|t2|t3|t4) host_var="HOST${1#t}" ;;
  "")          host_var="HOST" ;;
  *)           fatal "Unknown target '$1'. Use t1|t2|t3|t4, or nothing for HOST" ;;
esac

SSH_KEY=$(cred SSH_KEY)
DEPLOY_USER=$(cred USER)
DEPLOY_HOST=$(cred "$host_var")

[[ -n "$SSH_KEY" ]]     || fatal "SSH_KEY not set in $CRED_FILE"
[[ -n "$DEPLOY_USER" ]] || fatal "USER not set in $CRED_FILE"
[[ -n "$DEPLOY_HOST" ]] || fatal "$host_var not set in $CRED_FILE"
[[ -f "$SSH_KEY" ]]     || fatal "SSH key $SSH_KEY not found"

# ── Build output ─────────────────────────────────────────

[[ -f dist/index.html ]] || fatal "dist/index.html missing — run 'make deploy' (it builds first)"
grep -q '"/admin/assets/' dist/index.html \
  || fatal "dist/ was not built for /admin/ — check 'base' in vite.config.ts and rebuild"
entry_js=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -n 1)

# ── Upload ───────────────────────────────────────────────

SSH_CMD="ssh -o ConnectTimeout=10 -i '$SSH_KEY'"
remote() { ssh -o ConnectTimeout=10 -i "$SSH_KEY" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"; }

# /apps/www may not belong to the deploy user, so the remote side runs under sudo
# (math-svr's deploy already relies on passwordless sudo for nginx).
push() {
  rsync -rlptz --rsync-path="sudo rsync" -e "$SSH_CMD" "$@" \
    dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEST_DIR}/"
}

info "Deploying dist/ to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEST_DIR}"
remote "sudo mkdir -p '$DEST_DIR'"

# New hashed assets go up before the index.html that references them, so a visitor
# never loads an index.html whose bundle is not there yet. The second pass swaps
# index.html and removes files from older builds.
push --exclude=/index.html
push --delete

# ── Smoke check ──────────────────────────────────────────

# Without the nginx block, /admin/ still answers 200 with the landing page, so check
# for this build's bundle. /users exercises the SPA fallback to /admin/index.html.
failed=0
for path in / /users; do
  if curl -fsS --max-time 15 "${PUBLIC_URL}${path}" 2>/dev/null | grep -q "$entry_js"; then
    info "OK  ${PUBLIC_URL}${path}"
  else
    warn "${PUBLIC_URL}${path} does not serve this build"
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  warn "Files are on the host, but nginx is not serving them as expected."
  warn "Add deploy/nginx-admin.conf to both server blocks of /etc/nginx/sites-available/numi.asia, then: sudo nginx -t && sudo systemctl reload nginx"
  exit 1
fi

info "Done: ${PUBLIC_URL}/"
