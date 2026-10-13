/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DiscordAuthService } from '@/server/oauth/DiscordAuthService.js';

// Keep these HTTP tests independent of unrelated services and database connections.
vi.mock('@/core/HttpRequestService.js', () => ({ HttpRequestService: class {} }));
vi.mock('@/core/UserAuthService.js', () => ({ UserAuthService: class {} }));
vi.mock('@/core/WebAuthnService.js', () => ({ WebAuthnService: class {} }));
vi.mock('@/server/api/AuthenticateService.js', () => ({ AuthenticateService: class {} }));
vi.mock('@/server/api/RateLimiterService.js', () => ({ RateLimiterService: class {} }));
vi.mock('@/server/api/SigninService.js', () => ({ SigninService: class {} }));

const origin = 'https://dmsky.example';
const discordId = '123456789012345678';
const servers: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
	await Promise.all(servers.splice(0).map(server => server.close()));
});

async function setup(connected = true) {
	const user = { id: 'alice', host: null, isSuspended: false, token: 'a'.repeat(32) };
	const profile = { userId: user.id, discordId: connected ? discordId : null, password: bcrypt.hashSync('password', 4), twoFactorEnabled: false, securityKeysAvailable: false };
	const config = { url: origin, discord: { clientId: '234567890123456789', clientSecret: 'private-discord-secret' }, enableIpRateLimit: true };
	const records = new Map<string, string>();
	const redis = {
		setex: vi.fn(async (key: string, _ttl: number, value: string) => records.set(key, value)),
		get: vi.fn(async (key: string) => records.get(key) ?? null),
		getdel: vi.fn(async (key: string) => {
			const value = records.get(key) ?? null;
			records.delete(key);
			return value;
		}),
	};
	const users = { findOneBy: vi.fn(async () => user.isSuspended || user.host !== null ? null : user) };
	const profiles = {
		findOneByOrFail: vi.fn(async () => profile),
		findOneBy: vi.fn(async ({ discordId: id }: { discordId: string }) => profile.discordId === id ? profile : null),
		update: vi.fn(async (_query: unknown, change: { discordId: string | null }) => {
			profile.discordId = change.discordId;
			return { affected: 1 };
		}),
	};
	const http = {
		send: vi.fn(async (_url: string, _options: unknown) => ({ json: async () => ({ access_token: 'discord-access-token', refresh_token: 'discord-refresh-token' }) })),
		getJson: vi.fn(async () => ({ id: discordId })),
	};
	const authenticate = { authenticate: vi.fn(async (token: string) => token === user.token ? [user, null] : [null, null]) };
	const twoFactor = { twoFactorAuthenticate: vi.fn(async () => undefined) };
	const webAuthn = {
		initiateAuthentication: vi.fn(async () => ({ challenge: 'challenge', rpId: 'dmsky.example' })),
		verifyAuthentication: vi.fn(async () => true),
	};
	const limiter = { limit: vi.fn(async () => null) };
	const signin = { signin: vi.fn((_request: unknown, _reply: unknown, account: typeof user) => ({ finished: true, id: account.id, i: account.token })) };
	const service = new DiscordAuthService(config as never, redis as never, users as never, profiles as never, http as never, authenticate as never, twoFactor as never, webAuthn as never, limiter as never, signin as never);
	const server = Fastify();
	servers.push(server);
	await server.register(service.createServer, { prefix: '/auth/discord' });
	await server.ready();
	const post = (action: string, payload: Record<string, unknown> = {}, cookie?: string, requestOrigin = origin) => server.inject({ method: 'POST', url: `/auth/discord/${action}`, payload, headers: { origin: requestOrigin, ...(cookie ? { cookie } : {}) } });
	const cookie = (response: Awaited<ReturnType<typeof server.inject>>, name: string) => {
		const values = response.headers['set-cookie'];
		const cookies = typeof values === 'string' ? [values] : values ?? [];
		return cookies.find(value => value.startsWith(`${name}=`))?.split(';')[0];
	};
	const callback = (state: string, flowCookie?: string, suffix = '&code=authorization-code') => server.inject({ method: 'GET', url: `/auth/discord/callback?state=${state}${suffix}`, headers: flowCookie ? { cookie: flowCookie } : {} });
	const beginSignin = async () => {
		const response = await server.inject('/auth/discord/start');
		const state = new URL(response.headers.location!).searchParams.get('state')!;
		const result = await callback(state, cookie(response, 'dmsky_discord_state'));
		return cookie(result, 'dmsky_discord_ticket');
	};
	return { server, user, profile, config, records, redis, users, profiles, http, authenticate, twoFactor, webAuthn, limiter, signin, post, cookie, callback, beginSignin };
}

describe('Discord authentication HTTP flow', () => {
	test('exposes only availability and keeps credentials private', async () => {
		const context = await setup();
		const response = await context.server.inject('/auth/discord/');
		expect(response.json()).toEqual({ enabled: true });
		expect(response.headers['cache-control']).toBe('no-store');
		context.config.discord = undefined as never;
		expect((await context.server.inject('/auth/discord/')).json()).toEqual({ enabled: false });
		expect((await context.server.inject('/auth/discord/start')).statusCode).toBe(404);
	});

	test('requests identify only with a short lived secure browser-bound state', async () => {
		const context = await setup();
		const response = await context.server.inject('/auth/discord/start');
		const url = new URL(response.headers.location!);
		expect(url.origin).toBe('https://discord.com');
		expect(url.searchParams.get('scope')).toBe('identify');
		expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/auth/discord/callback`);
		expect(url.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/);
		expect(response.headers['set-cookie']).toContain('HttpOnly; SameSite=Lax; Max-Age=300; Secure');
		expect(context.redis.setex.mock.calls[0][1]).toBe(300);
	});

	test('rejects missing, mismatched, expired and replayed state before calling Discord', async () => {
		const context = await setup();
		const response = await context.server.inject('/auth/discord/start');
		const state = new URL(response.headers.location!).searchParams.get('state')!;
		const cookie = context.cookie(response, 'dmsky_discord_state');
		expect((await context.callback(state)).statusCode).toBe(400);
		expect((await context.callback('b'.repeat(64), cookie)).statusCode).toBe(400);
		expect(context.http.send).not.toHaveBeenCalled();
		context.records.clear();
		expect((await context.callback(state, cookie)).statusCode).toBe(400);
		const response2 = await context.server.inject('/auth/discord/start');
		const state2 = new URL(response2.headers.location!).searchParams.get('state')!;
		const cookie2 = context.cookie(response2, 'dmsky_discord_state');
		await context.callback(state2, cookie2);
		expect((await context.callback(state2, cookie2)).statusCode).toBe(400);
	});

	test('handles cancellation without exchanging a code', async () => {
		const context = await setup();
		const response = await context.server.inject('/auth/discord/start');
		const result = await context.callback(new URL(response.headers.location!).searchParams.get('state')!, context.cookie(response, 'dmsky_discord_state'), '&error=access_denied');
		expect(result.headers.location).toBe('/signin/discord?error=cancelled');
		expect(context.http.send).not.toHaveBeenCalled();
	});

	test('signs in an existing linked user once without credentials in redirects or Redis', async () => {
		const context = await setup();
		const ticket = await context.beginSignin();
		expect(ticket).toBeDefined();
		expect(JSON.stringify([...context.records])).not.toContain(context.user.token);
		expect(JSON.stringify([...context.records])).not.toContain('discord-access-token');
		const response = await context.post('finish', {}, ticket);
		expect(response.json()).toEqual({ finished: true, id: 'alice', i: context.user.token });
		expect(context.signin.signin).toHaveBeenCalledTimes(1);
		expect((await context.post('finish', {}, ticket)).statusCode).toBe(403);
		const params = context.http.send.mock.calls[0][1] as { body: URLSearchParams };
		expect(params.body.get('grant_type')).toBe('authorization_code');
	});

	test('does not create an account for an unlinked Discord ID', async () => {
		const context = await setup(false);
		expect(await context.beginSignin()).toBeUndefined();
		expect(context.signin.signin).not.toHaveBeenCalled();
	});

	test.each(['suspension', 'token rotation', 'unlinking', 'expiry'])('revokes a pending login after %s', async reason => {
		const context = await setup();
		const ticket = await context.beginSignin();
		if (reason === 'suspension') context.user.isSuspended = true;
		if (reason === 'token rotation') context.user.token = 'b'.repeat(32);
		if (reason === 'unlinking') context.profile.discordId = null;
		if (reason === 'expiry') context.records.clear();
		expect((await context.post('finish', {}, ticket)).statusCode).toBe(403);
		expect(context.signin.signin).not.toHaveBeenCalled();
	});

	test('requires local two factor authentication after Discord authorization', async () => {
		const context = await setup();
		context.profile.twoFactorEnabled = true;
		const ticket = await context.beginSignin();
		expect((await context.post('finish', {}, ticket)).json()).toEqual({ finished: false, next: 'totp' });
		expect(context.signin.signin).not.toHaveBeenCalled();
		expect((await context.post('finish', { token: '123456' }, ticket)).statusCode).toBe(200);
		expect(context.twoFactor.twoFactorAuthenticate).toHaveBeenCalledWith(context.profile, '123456');
	});

	test('rejects invalid two factor codes and consumes the ticket', async () => {
		const context = await setup();
		context.profile.twoFactorEnabled = true;
		context.twoFactor.twoFactorAuthenticate.mockRejectedValueOnce(new Error('invalid code'));
		const ticket = await context.beginSignin();
		expect((await context.post('finish', { token: 'wrong' }, ticket)).statusCode).toBe(403);
		expect((await context.post('finish', { token: '123456' }, ticket)).statusCode).toBe(403);
		expect(context.signin.signin).not.toHaveBeenCalled();
	});

	test('supports registered passkeys as the local second factor', async () => {
		const context = await setup();
		context.profile.twoFactorEnabled = true;
		context.profile.securityKeysAvailable = true;
		const ticket = await context.beginSignin();
		expect((await context.post('finish', {}, ticket)).json().next).toBe('passkey');
		expect((await context.post('finish', { credential: { id: 'registered-key' } }, ticket)).statusCode).toBe(200);
		expect(context.webAuthn.verifyAuthentication).toHaveBeenCalledWith('alice', { id: 'registered-key' });
	});

	test('rejects cross origin completion even with a valid ticket', async () => {
		const context = await setup();
		const ticket = await context.beginSignin();
		expect((await context.post('finish', {}, ticket, 'https://attacker.example')).statusCode).toBe(403);
		expect((await context.post('finish', {}, ticket)).statusCode).toBe(200);
	});

	test('links only after native authentication and password verification', async () => {
		const context = await setup(false);
		expect((await context.post('connect', { i: context.user.token, password: 'wrong' })).statusCode).toBe(403);
		const response = await context.post('connect', { i: context.user.token, password: 'password' });
		expect(response.statusCode).toBe(200);
		const state = new URL(response.json().url).searchParams.get('state')!;
		const result = await context.callback(state, context.cookie(response, 'dmsky_discord_state'));
		expect(result.headers.location).toBe('/settings/security?discord=connected');
		expect(context.profile.discordId).toBe(discordId);
	});

	test('rejects application tokens and requires the local second factor for linking', async () => {
		const context = await setup(false);
		context.authenticate.authenticate.mockResolvedValueOnce([context.user, {}] as never);
		expect((await context.post('connect', { i: context.user.token, password: 'password' })).statusCode).toBe(403);
		context.profile.twoFactorEnabled = true;
		expect((await context.post('connect', { i: context.user.token, password: 'password' })).statusCode).toBe(403);
		expect((await context.post('connect', { i: context.user.token, password: 'password', token: '123456' })).statusCode).toBe(200);
	});

	test('rejects token rotation during linking and does not expose duplicate-link database errors', async () => {
		const context = await setup(false);
		const response = await context.post('connect', { i: context.user.token, password: 'password' });
		context.user.token = 'b'.repeat(32);
		const result = await context.callback(new URL(response.json().url).searchParams.get('state')!, context.cookie(response, 'dmsky_discord_state'));
		expect(result.headers.location).toBe('/settings/security?discord=failed');
		expect(context.profiles.update).not.toHaveBeenCalled();
		const response2 = await context.post('connect', { i: context.user.token, password: 'password' });
		context.profiles.update.mockRejectedValueOnce(new Error('duplicate Discord ID'));
		const result2 = await context.callback(new URL(response2.json().url).searchParams.get('state')!, context.cookie(response2, 'dmsky_discord_state'));
		expect(result2.headers.location).toBe('/settings/security?discord=failed');
		expect(result2.body).not.toContain('duplicate');
	});

	test('requires reauthentication to disconnect, including when Discord is disabled', async () => {
		const context = await setup();
		context.config.discord = undefined as never;
		expect((await context.post('disconnect', { i: context.user.token })).statusCode).toBe(403);
		expect((await context.post('disconnect', { i: context.user.token, password: 'password' })).statusCode).toBe(204);
		expect(context.profile.discordId).toBeNull();
	});

	test('rate limits authorization requests', async () => {
		const context = await setup();
		context.limiter.limit.mockResolvedValueOnce({ code: 'RATE_LIMIT_EXCEEDED' } as never);
		expect((await context.server.inject('/auth/discord/start')).statusCode).toBe(429);
		expect(context.records.size).toBe(0);
	});
});
