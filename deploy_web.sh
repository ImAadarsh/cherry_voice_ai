#!/usr/bin/env bash
# Deploy Cherry Voice AI dashboard to Zaam Hostinger VPS.
#
# Site: https://cherryvoiceai.com
# PM2:  cherry-voice-ai on :4014
#
# Usage (from project root):
#   ./deploy_web.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ssh_user="${SSH_USER:-root}"
ssh_host="${SSH_HOST:-153.92.209.187}"
ssh_key="${SSH_KEY:-$HOME/.ssh/id_ed25519_hostinger}"
app_dir="${APP_DIR:-/var/www/cherry-voice-ai}"
git_repo="${GIT_REPO:-git@github.com:ImAadarsh/cherry_voice_ai.git}"
branch="${BRANCH:-main}"
process_name="${PROCESS_NAME:-cherry-voice-ai}"
api_port="${PORT:-4014}"
domain="${WEB_DOMAIN:-cherryvoiceai.com}"

ssh_target="${ssh_user}@${ssh_host}"
ssh_base_opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -i "$ssh_key" -o IdentitiesOnly=yes -o BatchMode=yes)

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ssh_key" ]] || die "SSH key not found: ${ssh_key}"

remote() {
  ssh "${ssh_base_opts[@]}" "$ssh_target" "$@"
}

ensure_git_checkout() {
  log "Pulling ${branch} at ${app_dir}…"
  remote "set -euo pipefail
export GIT_TERMINAL_PROMPT=0
git config --global --add safe.directory '${app_dir}' 2>/dev/null || true
if [ ! -d '${app_dir}/.git' ]; then
  git clone --branch '${branch}' --single-branch '${git_repo}' '${app_dir}'
else
  cd '${app_dir}'
  git fetch --prune origin
  git checkout '${branch}'
  git reset --hard \"origin/${branch}\"
fi
cd '${app_dir}'
echo \"At \$(git rev-parse --short HEAD)\"
"
}

build_and_restart() {
  log "Installing deps, migrating DB, building, restarting PM2…"
  remote "set -euo pipefail
cd '${app_dir}'
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run db:migrate
npm run build
mkdir -p logs uploads
if pm2 describe '${process_name}' >/dev/null 2>&1; then
  pm2 restart '${process_name}' --update-env
else
  PORT='${api_port}' HOSTNAME=0.0.0.0 pm2 start npm --name '${process_name}' --time -- start
fi
pm2 save
"
}

health_checks() {
  log "Health check http://127.0.0.1:${api_port}/api/health …"
  remote "set -e
for i in \$(seq 1 60); do
  body=\$(curl -sS --connect-timeout 2 'http://127.0.0.1:${api_port}/api/health' || true)
  if echo \"\$body\" | grep -q '\"ok\"'; then
    echo \"Local OK: \$body\"
    exit 0
  fi
  sleep 1
done
echo 'Local health failed' >&2
pm2 logs '${process_name}' --lines 40 --nostream || true
exit 1
"

  log "Public health https://${domain}/api/health …"
  sleep 3
  pub_body="$(curl -sS --connect-timeout 25 "https://${domain}/api/health" || echo FAILED)"
  log "Public: ${pub_body}"
}

[[ "${1:-}" == "--help" ]] && { sed -n '2,12p' "$0"; exit 0; }

ensure_git_checkout
build_and_restart
health_checks
log "Deploy complete: https://${domain}"
