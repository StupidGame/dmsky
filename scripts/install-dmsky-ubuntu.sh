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
duckdns_token_file=''
check_only=false

usage() {
	cat <<'EOF'
Usage: sudo bash scripts/install-dmsky-ubuntu.sh [--domain example.com] [--email admin@example.com] [--duckdns-token-file /root/duckdns-token] [--check]

Installs DMSKY from the public develop branch on a fresh Ubuntu 24.04 server.
It sets up PostgreSQL, Redis, Node.js 26, pnpm, systemd, Nginx and Let's Encrypt.
Use --duckdns-token-file with a subdomain under duckdns.org to configure free dynamic DNS.
Other domains must already resolve to this server. Open ports 80 and 443 first.
--check runs the non-mutating host checks only.
EOF
}

while (($#)); do
	case "$1" in
		--domain|--email|--duckdns-token-file)
			(($# >= 2)) || { usage >&2; exit 2; }
			case "$1" in
				--domain) domain=$2 ;;
				--email) email=$2 ;;
				--duckdns-token-file) duckdns_token_file=$2 ;;
			esac
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
memory_kib=$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)
(( memory_kib >= 3 * 1024 * 1024 )) || fail 'At least 4 GB of VM memory is recommended; this host is too small to build Misskey.'
free_disk_kib=$(df -Pk /var/lib | awk 'NR == 2 { print $4 }')
(( free_disk_kib >= 24 * 1024 * 1024 )) || fail 'At least 24 GB of free disk space is required before installation.'
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
if [[ -n $duckdns_token_file ]]; then
	[[ $domain == *.duckdns.org ]] || fail '--duckdns-token-file requires a duckdns.org subdomain.'
	duckdns_subdomain=${domain%.duckdns.org}
	[[ $duckdns_subdomain =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'Use a single lowercase DuckDNS subdomain.'
	[[ -f $duckdns_token_file && ! -L $duckdns_token_file ]] || fail 'The DuckDNS token file must be a regular file.'
	[[ $(stat -c '%u' "$duckdns_token_file") == 0 ]] || fail 'The DuckDNS token file must be owned by root.'
	duckdns_mode=$(stat -c '%a' "$duckdns_token_file")
	(( (8#$duckdns_mode & 077) == 0 )) || fail 'The DuckDNS token file must not be readable by other users.'
	duckdns_token=$(<"$duckdns_token_file")
	[[ $duckdns_token =~ ^[A-Za-z0-9-]{16,128}$ ]] || fail 'The DuckDNS token file contains an invalid token.'
fi

step 'Installing base packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git build-essential ffmpeg python3 openssl postgresql redis-server nginx certbot python3-certbot-nginx

if (( memory_kib < 8 * 1024 * 1024 )) && (( $(awk '/^SwapTotal:/ { print $2 }' /proc/meminfo) < 2 * 1024 * 1024 )); then
	step 'Adding swap for the Misskey build on a small VM'
	[[ ! -e /var/lib/dmsky-swap ]] || fail 'Swap file already exists; inspect it before retrying.'
	fallocate -l 4G /var/lib/dmsky-swap
	chmod 0600 /var/lib/dmsky-swap
	mkswap /var/lib/dmsky-swap >/dev/null
	swapon /var/lib/dmsky-swap
	printf '/var/lib/dmsky-swap none swap sw 0 0\n' >> /etc/fstab
fi

step 'Installing Node.js 26 and pnpm'
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_26.x nodistro main\n' > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 26 || minor < 4) process.exit(1)' || fail 'Node.js 26.4.0 or newer is required.'
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
id: 'aidx'
proxyRemoteFiles: true
signToActivityPubGet: true
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.config/default.yml"
printf '%s\n' "$setup_password" > /root/dmsky-setup-password

if [[ -n $duckdns_token_file ]]; then
	step 'Configuring DuckDNS updates'
	install -d -m 0700 /etc/dmsky
	printf 'DUCKDNS_SUBDOMAIN=%s\nDUCKDNS_TOKEN=%s\n' "$duckdns_subdomain" "$duckdns_token" > /etc/dmsky/duckdns.env
	chmod 0600 /etc/dmsky/duckdns.env
	install -D -m 0755 "$APP_DIR/scripts/update-duckdns.sh" /usr/local/libexec/dmsky-update-duckdns
	cat > /etc/systemd/system/dmsky-duckdns.service <<'EOF'
[Unit]
Description=Update DMSKY DuckDNS record
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/dmsky/duckdns.env
ExecStart=/usr/local/libexec/dmsky-update-duckdns
EOF
	cat > /etc/systemd/system/dmsky-duckdns.timer <<'EOF'
[Unit]
Description=Keep DMSKY DuckDNS record current

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=dmsky-duckdns.service

[Install]
WantedBy=timers.target
EOF
	systemctl daemon-reload
	systemctl start dmsky-duckdns.service
	systemctl enable --now dmsky-duckdns.timer
fi

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
