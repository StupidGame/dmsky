/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { discordAuth, discordReturnPath } from '@/utility/discord-auth.js';

beforeEach(() => {
	window.sessionStorage.clear();
});

describe('Discord login completion', () => {
	test('preserves a local return page and consumes it once', () => {
		window.sessionStorage.setItem('dmsky.discord.returnTo', '/notes/example?mode=detail#reply');
		expect(discordReturnPath()).toBe('/notes/example?mode=detail#reply');
		expect(discordReturnPath()).toBe('/');
	});

	test.each(['https://attacker.example', '//attacker.example', '/\\attacker.example', '/signin/discord', '/auth/discord/start'])('rejects unsafe or recursive return paths: %s', path => {
		window.sessionStorage.setItem('dmsky.discord.returnTo', path);
		expect(discordReturnPath()).toBe('/');
	});

	test('sends authentication data only in the POST body', async () => {
		const request = vi.spyOn(window, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ connected: true }), { status: 200 }));
		expect(await discordAuth('status', { i: 'private-token' })).toEqual({ connected: true });
		expect(request).toHaveBeenCalledWith('/auth/discord/status', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: '{"i":"private-token"}' }));
	});

	test('handles an empty disconnect response and rejects authentication failures', async () => {
		vi.spyOn(window, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 403 }));
		expect(await discordAuth('disconnect')).toBeUndefined();
		await expect(discordAuth('finish')).rejects.toThrow('Discord authentication failed');
	});
});
