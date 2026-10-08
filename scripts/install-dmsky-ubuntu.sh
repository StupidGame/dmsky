#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 DMSKY contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# Inspired by https://github.com/joinmisskey/bash-install/blob/main/ubuntu.sh
# This installer targets a fresh Ubuntu 24.04 host with systemd.

set -euo pipefail

readonly REPOSITORY_URL='https://github.com/StupidGame/dmsky.git'
readonly REPOSITORY_BRANCH='develop'
readonly APP_USER='dmsky'
readonly APP_DIR='/var/lib/dmsky/app'
readonly APP_PORT='3000'
readonly DB_NAME='dmsky'
readonly DB_USER='dmsky'

domain=''
email=''
check_only=false

usage() {
	cat <<'EOF'
Usage: sudo bash scripts/install-dmsky-ubuntu.sh [--domain example.com] [--email admin@example.com] [--check]

Installs DMSKY from the public develop branch on a fresh Ubuntu 24.04 server.
It sets up PostgreSQL, Redis, Node.js 24, pnpm, systemd, Nginx and Let's Encrypt.
The domain must already resolve to this server, with ports 80 and 443 open.
--check runs the non-mutating host checks only.
EOF
}

while (($#)); do
	case "$1" in
		--domain|--email)
			(($# >= 2)) || { usage >&2; exit 2; }
			if [[ $1 == --domain ]]; then domain=$2; else email=$2; fi
			shift 2
			;;
		--check) check_only=true; shift ;;
		--help|-h) usage; exit 0 ;;
		*) usage >&2; exit 2 ;;
	esac
done

fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

[[ $(id -u) -eq 0 ]] || fail 'Run as root with sudo.'
[[ -f /etc/os-release ]] || fail 'Cannot detect the operating system.'
# shellcheck source=/dev/null
source /etc/os-release
[[ ${ID:-} == ubuntu && ${VERSION_ID:-} == 24.04 ]] || fail 'Ubuntu 24.04 is required.'
[[ $(uname -m) == x86_64 || $(uname -m) == aarch64 ]] || fail 'Only amd64 and arm64 are supported.'
[[ -d /run/systemd/system ]] || fail 'A running systemd installation is required.'
[[ ! -e $APP_DIR ]] || fail "$APP_DIR already exists; this installer only handles new installations."
[[ ! -e /etc/systemd/system/dmsky.service ]] || fail 'dmsky.service already exists.'
[[ ! -e /etc/nginx/sites-available/dmsky ]] || fail 'The DMSKY Nginx site already exists.'
[[ ! -e /root/dmsky-setup-password ]] || fail 'The setup password file already exists.'
! id "$APP_USER" &>/dev/null || fail "The $APP_USER account already exists."
if $check_only; then
	printf 'Host checks passed. No changes made.\n'
	exit 0
fi

if [[ -z $domain ]]; then read -r -p 'Server domain: ' domain; fi
if [[ -z $email ]]; then read -r -p "Let's Encrypt contact email: " email; fi
[[ $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ && $domain == *.* && $domain != *..* ]] || fail 'Enter a valid domain name.'
[[ $email =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail 'Enter a valid email address.'

step 'Installing base packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git build-essential ffmpeg python3 openssl postgresql redis-server nginx certbot python3-certbot-nginx

step 'Installing Node.js 24 and pnpm'
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main\n' > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
npm install --global pnpm@11.25.0
pnpm_path=$(command -v pnpm)

step 'Creating the application user and database'
useradd --system --create-home --user-group --home-dir /var/lib/dmsky --shell /bin/bash "$APP_USER"
[[ -d /var/lib/dmsky ]] || fail 'Application home directory is missing.'
systemctl enable --now postgresql redis-server
db_password=$(openssl rand -hex 24)
setup_password=$(openssl rand -hex 24)
if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1; then
	fail "PostgreSQL role $DB_USER already exists."
fi
if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
	fail "PostgreSQL database $DB_NAME already exists."
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$db_password'"
runuser -u postgres -- createdb --owner "$DB_USER" "$DB_NAME"

step 'Fetching and configuring DMSKY'
runuser -u "$APP_USER" -- git clone --depth 1 --branch "$REPOSITORY_BRANCH" "$REPOSITORY_URL" "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_USER" -m 0700 "$APP_DIR/.config"
umask 077
cat > "$APP_DIR/.config/default.yml" <<EOF
url: https://$domain/
port: $APP_PORT
setupPassword: '$setup_password'
db:
  host: 127.0.0.1
  port: 5432
  db: '$DB_NAME'
  user: '$DB_USER'
  pass: '$db_password'
redis:
  host: 127.0.0.1
  port: 6379
id: 'aid'
proxyRemoteFiles: true
signToActivityPubGet: true
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.config/default.yml"
printf '%s\n' "$setup_password" > /root/dmsky-setup-password

step 'Installing dependencies, building and migrating'
runuser -u "$APP_USER" -- env NODE_ENV=development bash -c "cd '$APP_DIR' && '$pnpm_path' install --frozen-lockfile"
runuser -u "$APP_USER" -- env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=4096 bash -c "cd '$APP_DIR' && '$pnpm_path' build && '$pnpm_path' init"

step 'Creating the systemd service'
cat > /etc/systemd/system/dmsky.service <<EOF
[Unit]
Description=DMSKY server
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$pnpm_path start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now dmsky.service

step 'Configuring Nginx and HTTPS'
cat > /etc/nginx/sites-available/dmsky <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    client_max_body_size 250m;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -s /etc/nginx/sites-available/dmsky /etc/nginx/sites-enabled/dmsky
nginx -t
systemctl enable --now nginx
systemctl reload nginx
certbot --nginx --non-interactive --agree-tos --redirect --email "$email" -d "$domain"

printf '\nDMSKY is available at https://%s/\n' "$domain"
printf 'Initial setup password: /root/dmsky-setup-password (root only)\n'
printf 'After creating the admin account, set Repository URL to https://github.com/StupidGame/dmsky in /admin/settings.\n'
