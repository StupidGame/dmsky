#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 DMSKY contributors
# SPDX-License-Identifier: AGPL-3.0-only

set -euo pipefail

[[ ${DUCKDNS_SUBDOMAIN:-} =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'Invalid DuckDNS subdomain' >&2; exit 1; }
[[ ${DUCKDNS_TOKEN:-} =~ ^[A-Za-z0-9-]{16,128}$ ]] || { echo 'Invalid DuckDNS token' >&2; exit 1; }

# Pass the token through stdin so it is absent from the process command line.
response=$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s"\n' "$DUCKDNS_SUBDOMAIN" "$DUCKDNS_TOKEN" | curl --fail --silent --show-error --max-time 30 --config -)
[[ $response == OK ]] || { echo 'DuckDNS update failed' >&2; exit 1; }
