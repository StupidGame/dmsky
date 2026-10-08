/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseConnection(name, value, protocols) {
	if (!value) throw new Error(`${name} is required`);
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid connection URL`);
	}
	if (!protocols.includes(url.protocol) || !url.hostname || !url.port) {
		throw new Error(`${name} must include a supported scheme, host, and port`);
	}
	const port = Number(url.port);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`${name} has an invalid port`);
	}
	return url;
}

function parseOrigin(value) {
	if (!value) throw new Error('DMSKY_URL or RENDER_EXTERNAL_URL is required');
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('The public URL must be a valid HTTPS URL');
	}
	if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
		throw new Error('The public URL must be an HTTPS origin without a path, query, or credentials');
	}
	return `${url.origin}/`;
}

function parsePort(value, name) {
	if (!/^[1-9]\d*$/.test(value ?? '')) throw new Error(`${name} must be a TCP port`);
	const port = Number(value);
	if (port > 65535) throw new Error(`${name} must be a TCP port`);
	return port;
}

export function createRenderConfig(env) {
	const db = parseConnection('DATABASE_URL', env.DATABASE_URL, ['postgres:', 'postgresql:']);
	const redis = parseConnection('REDIS_URL', env.REDIS_URL, ['redis:', 'rediss:']);
	if (!db.username || !db.password || db.pathname.length < 2) {
		throw new Error('DATABASE_URL must include a database name, user, and password');
	}
	if (!env.DMSKY_SETUP_PASSWORD || env.DMSKY_SETUP_PASSWORD.length < 16) {
		throw new Error('DMSKY_SETUP_PASSWORD must have at least 16 characters');
	}
	const redisDatabase = redis.pathname === '/' ? 0 : Number(redis.pathname.slice(1));
	if (!Number.isInteger(redisDatabase) || redisDatabase < 0) {
		throw new Error('REDIS_URL has an invalid database number');
	}
	return {
		url: parseOrigin(env.DMSKY_URL || env.RENDER_EXTERNAL_URL),
		port: parsePort(env.PORT || '10000', 'PORT'),
		setupPassword: env.DMSKY_SETUP_PASSWORD,
		id: 'aidx',
		db: {
			host: db.hostname,
			port: Number(db.port),
			db: decodeURIComponent(db.pathname.slice(1)),
			user: decodeURIComponent(db.username),
			pass: decodeURIComponent(db.password),
		},
		redis: {
			host: redis.hostname,
			port: Number(redis.port),
			pass: decodeURIComponent(redis.password),
			...(redis.username ? { username: decodeURIComponent(redis.username) } : {}),
			...(redisDatabase ? { db: redisDatabase } : {}),
			...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
		},
	};
}

function yamlValue(value, indentation = 0) {
	if (value && typeof value === 'object') {
		const entries = Object.entries(value);
		if (entries.length === 0) return '{}';
		return `\n${entries.map(([key, child]) => `${' '.repeat(indentation)}${key}: ${yamlValue(child, indentation + 2)}`).join('\n')}`;
	}
	return JSON.stringify(value);
}

export function renderYaml(config) {
	return `${Object.entries(config).map(([key, value]) => `${key}: ${yamlValue(value, 2)}`).join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const config = createRenderConfig(process.env);
		const configDir = resolve('.config');
		const configPath = resolve(configDir, 'default.yml');
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
		writeFileSync(configPath, renderYaml(config), { mode: 0o600 });
		chmodSync(configPath, 0o600);
	} catch (error) {
		console.error(`Render configuration failed: ${error.message}`);
		process.exitCode = 1;
	}
}
