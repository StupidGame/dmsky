#!/usr/bin/env bash

# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

set -euo pipefail

if [[ ! -w /misskey/files ]]; then
	echo 'Render storage is not writable at /misskey/files' >&2
	exit 1
fi

node scripts/render-config.mjs
exec pnpm run migrateandstart
