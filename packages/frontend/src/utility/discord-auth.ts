/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export async function discordAuth<T>(action: 'status' | 'connect' | 'disconnect' | 'finish', body: Record<string, unknown> = {}): Promise<T> {
	const response = await window.fetch(`/auth/discord/${action}`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error('Discord authentication failed');
	return response.status === 204 ? undefined as T : response.json();
}

export function discordReturnPath(): string {
	const stored = window.sessionStorage.getItem('dmsky.discord.returnTo');
	window.sessionStorage.removeItem('dmsky.discord.returnTo');
	if (!stored?.startsWith('/')) return '/';
	const destination = new URL(stored, window.location.origin);
	if (destination.origin !== window.location.origin || destination.pathname.startsWith('/auth/discord') || destination.pathname === '/signin/discord') return '/';
	return `${destination.pathname}${destination.search}${destination.hash}`;
}
