/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { IsNull } from 'typeorm';
import type { Redis } from 'ioredis';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { UserProfilesRepository, UsersRepository } from '@/models/_.js';
import type { MiLocalUser } from '@/models/User.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { UserAuthService } from '@/core/UserAuthService.js';
import { WebAuthnService } from '@/core/WebAuthnService.js';
import { bindThis } from '@/decorators.js';
import { FastifyReplyError } from '@/misc/fastify-reply-error.js';
import { getIpHash } from '@/misc/get-ip-hash.js';
import { AuthenticateService } from '@/server/api/AuthenticateService.js';
import { RateLimiterService } from '@/server/api/RateLimiterService.js';
import { SigninService } from '@/server/api/SigninService.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type AccountProof = { userId: string; tokenHash: string; };
type Flow = { mode: 'signin'; } | ({ mode: 'connect'; } & AccountProof);
type Ticket = AccountProof & { discordId: string; };
type AuthBody = { i?: string; password?: string; token?: string; credential?: AuthenticationResponseJSON; };

const lifetime = 300;
const flowCookie = 'dmsky_discord_state';
const ticketCookie = 'dmsky_discord_ticket';
const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class DiscordAuthService {
	constructor(
		@Inject(DI.config) private config: Config,
		@Inject(DI.redis) private redisClient: Redis,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
		@Inject(DI.userProfilesRepository) private userProfilesRepository: UserProfilesRepository,
		private httpRequestService: HttpRequestService,
		private authenticateService: AuthenticateService,
		private userAuthService: UserAuthService,
		private webAuthnService: WebAuthnService,
		private rateLimiterService: RateLimiterService,
		private signinService: SigninService,
	) {}

	private get enabled(): boolean {
		return !!(this.config.discord?.clientId && this.config.discord.clientSecret);
	}

	private cookie(request: FastifyRequest, name: string): string | null {
		const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
		return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
	}

	private setCookie(reply: FastifyReply, name: string, value: string, maxAge = lifetime): void {
		reply.header('Set-Cookie', `${name}=${value}; Path=/auth/discord; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.config.url.startsWith('https:') ? '; Secure' : ''}`);
	}

	private async limit(request: FastifyRequest): Promise<void> {
		if (this.config.enableIpRateLimit && await this.rateLimiterService.limit({ key: 'discord-auth', duration: 60 * 60 * 1000, max: 30 }, getIpHash(request.ip))) {
			throw new FastifyReplyError(429, 'RATE_LIMIT_EXCEEDED');
		}
	}

	private async localUser(proof: AccountProof): Promise<MiLocalUser> {
		// Read the database again so token rotation and suspension revoke pending flows.
		const user = await this.usersRepository.findOneBy({ id: proof.userId, host: IsNull(), isSuspended: false }) as MiLocalUser | null;
		if (!user?.token || fingerprint(user.token) !== proof.tokenHash) throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
		return user;
	}

	private async account(request: FastifyRequest<{ Body: AuthBody }>, reauthenticate = false): Promise<MiLocalUser> {
		const [authenticated, accessToken] = await this.authenticateService.authenticate(request.body.i).catch(() => [null, null]);
		if (!authenticated || accessToken) throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
		const user = await this.localUser({ userId: authenticated.id, tokenHash: fingerprint(request.body.i!) });
		if (reauthenticate) {
			await this.limit(request);
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
			if (!request.body.password || !profile.password || !await bcrypt.compare(request.body.password, profile.password)) {
				throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
			}
			if (profile.twoFactorEnabled) {
				if (!request.body.token) throw new FastifyReplyError(403, 'TWO_FACTOR_REQUIRED');
				await this.userAuthService.twoFactorAuthenticate(profile, request.body.token).catch(() => {
					throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
				});
			}
		}
		return user;
	}

	private async begin(reply: FastifyReply, flow: Flow): Promise<string> {
		const state = randomBytes(32).toString('hex');
		await this.redisClient.setex(`discord:state:${state}`, lifetime, JSON.stringify(flow));
		this.setCookie(reply, flowCookie, state);
		const url = new URL('https://discord.com/oauth2/authorize');
		url.search = new URLSearchParams({
			client_id: this.config.discord!.clientId,
			redirect_uri: `${this.config.url}/auth/discord/callback`,
			response_type: 'code',
			scope: 'identify',
			state,
			prompt: 'consent',
		}).toString();
		return url.toString();
	}

	@bindThis
	public async createServer(fastify: FastifyInstance): Promise<void> {
		fastify.addHook('onRequest', async (request, reply) => {
			reply.header('Cache-Control', 'no-store');
			reply.header('Referrer-Policy', 'no-referrer');
			if (request.method === 'POST' && request.headers.origin !== this.config.url) {
				throw new FastifyReplyError(403, 'INVALID_ORIGIN');
			}
		});
		const bodySchema = {
			type: 'object',
			additionalProperties: false,
			properties: {
				i: { type: 'string', maxLength: 128 },
				password: { type: 'string', maxLength: 1024 },
				token: { type: 'string', maxLength: 128 },
				credential: { type: 'object' },
			},
		} as const;

		fastify.get('/', async () => ({ enabled: this.enabled }));
		fastify.post<{ Body: AuthBody }>('/status', { schema: { body: bodySchema } }, async request => {
			const user = await this.account(request);
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
			return { enabled: this.enabled, connected: profile.discordId !== null };
		});
		fastify.post<{ Body: AuthBody }>('/connect', { schema: { body: bodySchema } }, async (request, reply) => {
			if (!this.enabled) throw new FastifyReplyError(404, 'DISCORD_DISABLED');
			const user = await this.account(request, true);
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
			if (profile.discordId !== null) throw new FastifyReplyError(409, 'ALREADY_CONNECTED');
			return { url: await this.begin(reply, { mode: 'connect', userId: user.id, tokenHash: fingerprint(user.token!) }) };
		});
		fastify.post<{ Body: AuthBody }>('/disconnect', { schema: { body: bodySchema } }, async (request, reply) => {
			const user = await this.account(request, true);
			await this.userProfilesRepository.update({ userId: user.id }, { discordId: null });
			return reply.code(204).send();
		});
		fastify.get('/start', async (request, reply) => {
			if (!this.enabled) throw new FastifyReplyError(404, 'DISCORD_DISABLED');
			await this.limit(request);
			return reply.redirect(await this.begin(reply, { mode: 'signin' }));
		});
		fastify.get<{ Querystring: { state?: string; code?: string; error?: string; } }>('/callback', {
			schema: { querystring: {
				type: 'object',
				properties: {
					state: { type: 'string', maxLength: 64 },
					code: { type: 'string', maxLength: 2048 },
					error: { type: 'string', maxLength: 256 },
				},
			} },
		}, async (request, reply) => {
			if (!this.enabled) throw new FastifyReplyError(404, 'DISCORD_DISABLED');
			const { state, code, error } = request.query;
			if (!state || state !== this.cookie(request, flowCookie)) throw new FastifyReplyError(400, 'INVALID_STATE');
			const stored = await this.redisClient.getdel(`discord:state:${state}`);
			if (!stored) throw new FastifyReplyError(400, 'EXPIRED_STATE');
			this.setCookie(reply, flowCookie, '', 0);
			const flow = JSON.parse(stored) as Flow;
			const fail = (reason: string) => reply.redirect(`${flow.mode === 'connect' ? '/settings/security?discord=' : '/signin/discord?error='}${reason}`);
			if (error) return fail('cancelled');
			if (!code) return fail('failed');
			await this.limit(request);

			try {
				const response = await this.httpRequestService.send('https://discord.com/api/oauth2/token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						client_id: this.config.discord!.clientId,
						client_secret: this.config.discord!.clientSecret,
						grant_type: 'authorization_code',
						code,
						redirect_uri: `${this.config.url}/auth/discord/callback`,
					}),
				});
				const token = await response.json() as { access_token?: string; };
				if (!token.access_token) return fail('failed');
				const discord = await this.httpRequestService.getJson<{ id: string }>('https://discord.com/api/v10/users/@me', 'application/json', { Authorization: `Bearer ${token.access_token}` });
				if (typeof discord.id !== 'string' || !/^\d{17,20}$/.test(discord.id)) return fail('failed');

				if (flow.mode === 'connect') {
					await this.localUser(flow);
					// The unique index prevents the same Discord account being linked twice.
					const result = await this.userProfilesRepository.update({ userId: flow.userId, discordId: IsNull() }, { discordId: discord.id });
					return result.affected === 1 ? reply.redirect('/settings/security?discord=connected') : fail('failed');
				}
				const profile = await this.userProfilesRepository.findOneBy({ discordId: discord.id });
				if (!profile) return fail('notConnected');
				const user = await this.usersRepository.findOneBy({ id: profile.userId, host: IsNull(), isSuspended: false }) as MiLocalUser | null;
				if (!user?.token) return fail('failed');
				const ticket = randomBytes(32).toString('hex');
				await this.redisClient.setex(`discord:ticket:${ticket}`, lifetime, JSON.stringify({ userId: user.id, discordId: discord.id, tokenHash: fingerprint(user.token) } satisfies Ticket));
				this.setCookie(reply, ticketCookie, ticket);
				return reply.redirect('/signin/discord');
			} catch {
				// Never include provider errors: they may contain tokens or client credentials.
				return fail('failed');
			}
		});
		fastify.post<{ Body: AuthBody }>('/finish', { schema: { body: bodySchema } }, async (request, reply) => {
			if (!this.enabled) throw new FastifyReplyError(404, 'DISCORD_DISABLED');
			await this.limit(request);
			const ticket = this.cookie(request, ticketCookie);
			const stored = ticket ? await this.redisClient.get(`discord:ticket:${ticket}`) : null;
			if (!stored) throw new FastifyReplyError(403, 'EXPIRED_TICKET');
			const proof = JSON.parse(stored) as Ticket;
			const user = await this.localUser(proof);
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: user.id });
			if (profile.discordId !== proof.discordId) throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
			if (profile.twoFactorEnabled && !request.body.token && !request.body.credential) {
				return profile.securityKeysAvailable
					? { finished: false, next: 'passkey', authRequest: await this.webAuthnService.initiateAuthentication(user.id) }
					: { finished: false, next: 'totp' };
			}
			// Consume before verifying so even concurrent requests cannot reuse a ticket.
			if (!await this.redisClient.getdel(`discord:ticket:${ticket}`)) throw new FastifyReplyError(403, 'EXPIRED_TICKET');
			this.setCookie(reply, ticketCookie, '', 0);
			if (profile.twoFactorEnabled) {
				try {
					if (request.body.token) {
						await this.userAuthService.twoFactorAuthenticate(profile, request.body.token);
					} else if (!request.body.credential || !await this.webAuthnService.verifyAuthentication(user.id, request.body.credential)) {
						throw new Error('authentication failed');
					}
				} catch {
					throw new FastifyReplyError(403, 'AUTHENTICATION_FAILED');
				}
			}
			return this.signinService.signin(request, reply, user);
		});
	}
}
