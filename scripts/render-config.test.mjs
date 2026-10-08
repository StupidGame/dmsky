/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRenderConfig, renderYaml } from './render-config.mjs';

const env = {
	DATABASE_URL: 'postgresql://user:p%40ss%3Aword@postgres.internal:5432/misskey',
	REDIS_URL: 'redis://:r%40ssword@redis.internal:6379',
	DMSKY_SETUP_PASSWORD: 'a-long-random-setup-password',
	RENDER_EXTERNAL_URL: 'https://dmsky.onrender.com',
	PORT: '10000',
};

test('Render connections produce a complete Misskey config', () => {
	const config = createRenderConfig(env);
	assert.equal(config.url, 'https://dmsky.onrender.com/');
	assert.equal(config.db.pass, 'p@ss:word');
	assert.equal(config.redis.pass, 'r@ssword');
	assert.match(renderYaml(config), /^port: 10000$/m);
	assert.match(renderYaml(config), /^  pass: "p@ss:word"$/m);
});

test('TLS Redis connections and explicit public URLs are supported', () => {
	const config = createRenderConfig({
		...env,
		REDIS_URL: 'rediss://redis-user:secret@redis.internal:6380/2',
		DMSKY_URL: 'https://misskey.example.org',
	});
	assert.deepEqual(config.redis.tls, {});
	assert.equal(config.redis.db, 2);
	assert.equal(config.redis.username, 'redis-user');
	assert.equal(config.url, 'https://misskey.example.org/');
});

test('missing or unsafe deployment settings fail before startup', () => {
	assert.throws(() => createRenderConfig({ ...env, DATABASE_URL: '' }), /DATABASE_URL is required/);
	assert.throws(() => createRenderConfig({ ...env, DMSKY_SETUP_PASSWORD: 'short' }), /at least 16/);
	assert.throws(() => createRenderConfig({ ...env, DMSKY_URL: 'http://example.org' }), /HTTPS origin/);
	assert.throws(() => createRenderConfig({ ...env, PORT: '0' }), /TCP port/);
});

test('startup writes a private config file without printing credentials', () => {
	const workdir = mkdtempSync(join(tmpdir(), 'dmsky-render-'));
	try {
		const script = fileURLToPath(new URL('./render-config.mjs', import.meta.url));
		const result = spawnSync(process.execPath, [script], { cwd: workdir, env, encoding: 'utf8' });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout, '');
		const configPath = join(workdir, '.config/default.yml');
		assert.equal(statSync(configPath).mode & 0o777, 0o600);
		assert.match(readFileSync(configPath, 'utf8'), /setupPassword: "a-long-random-setup-password"/);
	} finally {
		rmSync(workdir, { recursive: true, force: true });
	}
});
