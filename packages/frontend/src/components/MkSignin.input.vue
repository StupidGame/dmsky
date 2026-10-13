<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.wrapper" data-testid="signin-page-input">
	<div :class="$style.root">
		<div :class="$style.avatar">
			<i class="ti ti-user"></i>
		</div>

		<!-- ログイン画面メッセージ -->
		<MkInfo v-if="message">
			{{ message }}
		</MkInfo>

		<!-- 外部サーバーへの転送 -->
		<div v-if="openOnRemote" class="_gaps_m">
			<div class="_gaps_s">
				<MkButton type="button" rounded primary style="margin: 0 auto;" @click="openRemote(openOnRemote)">
					{{ i18n.ts.continueOnRemote }} <i class="ti ti-external-link"></i>
				</MkButton>
				<button type="button" class="_button" :class="$style.instanceManualSelectButton" @click="specifyHostAndOpenRemote(openOnRemote)">
					{{ i18n.ts.specifyServerHost }}
				</button>
			</div>
			<div :class="$style.orHr">
				<p :class="$style.orMsg">{{ i18n.ts.or }}</p>
			</div>
		</div>

		<!-- username入力 -->
		<form class="_gaps_s" @submit.prevent="emit('usernameSubmitted', username)">
			<MkInput v-model="username" :placeholder="i18n.ts.username" type="text" pattern="^[a-zA-Z0-9_]+$" :spellcheck="false" autocomplete="username webauthn" autofocus required data-testid="signin-username">
				<template #prefix>@</template>
				<template #suffix>@{{ host }}</template>
			</MkInput>
			<MkButton type="submit" large primary rounded style="margin: 0 auto;" data-testid="signin-page-input-continue">{{ i18n.ts.continue }} <i class="ti ti-arrow-right"></i></MkButton>
		</form>

		<!-- パスワードレスログイン -->
		<div :class="$style.orHr">
			<p :class="$style.orMsg">{{ i18n.ts.or }}</p>
		</div>
		<div>
			<MkButton type="submit" style="margin: auto auto;" large rounded primary gradate @click="emit('passkeyClick', $event)">
				<i class="ti ti-device-usb" style="font-size: medium;"></i>{{ i18n.ts.signinWithPasskey }}
			</MkButton>
		</div>
		<div v-if="allowDiscord && discordEnabled">
			<MkButton type="button" large rounded style="margin: 0 auto;" @click="signinWithDiscord">
				<i class="ti ti-brand-discord" aria-hidden="true"></i> {{ i18n.tsx.signinWith({ x: 'Discord' }) }}
			</MkButton>
			<p :class="$style.discordCaption">{{ i18n.ts._discordLogin.signinDescription }}</p>
		</div>
	</div>
</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { toUnicode } from 'punycode.js';

import { query, extractDomain } from '@@/js/url.js';
import { host as configHost } from '@@/js/config.js';
import type { OpenOnRemoteOptions } from '@/utility/please-login.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkInfo from '@/components/MkInfo.vue';

const props = withDefaults(defineProps<{
	message?: string,
	openOnRemote?: OpenOnRemoteOptions,
	initialUsername?: string;
	allowDiscord?: boolean;
}>(), {
	message: '',
	openOnRemote: undefined,
	initialUsername: undefined,
	allowDiscord: false,
});

const emit = defineEmits<{
	(ev: 'usernameSubmitted', v: string): void;
	(ev: 'passkeyClick', v: PointerEvent): void;
}>();

const host = toUnicode(configHost);

const username = ref(props.initialUsername ?? '');
const discordEnabled = ref(false);

function signinWithDiscord(): void {
	window.sessionStorage.setItem('dmsky.discord.returnTo', `${window.location.pathname}${window.location.search}${window.location.hash}`);
	window.location.assign('/auth/discord/start');
}

onMounted(async () => {
	if (!props.allowDiscord) return;
	try {
		const response = await window.fetch('/auth/discord/', { cache: 'no-store' });
		if (response.ok) discordEnabled.value = (await response.json()).enabled === true;
	} catch {
		discordEnabled.value = false;
	}
});

//#region Open on remote
function openRemote(options: OpenOnRemoteOptions, targetHost?: string): void {
	switch (options.type) {
		case 'web':
		case 'lookup': {
			let _path: string;

			if (options.type === 'lookup') {
				// TODO: v2024.7.0以降が浸透してきたら正式なURLに変更する▼
				// _path = `/lookup?uri=${encodeURIComponent(_path)}`;
				_path = `/authorize-follow?acct=${encodeURIComponent(options.url)}`;
			} else {
				_path = options.path;
			}

			if (targetHost) {
				window.open(`https://${targetHost}${_path}`, '_blank', 'noopener');
			} else {
				window.open(`https://misskey-hub.net/mi-web/?path=${encodeURIComponent(_path)}`, '_blank', 'noopener');
			}
			break;
		}
		case 'share': {
			const params = query(options.params);
			if (targetHost) {
				window.open(`https://${targetHost}/share?${params}`, '_blank', 'noopener');
			} else {
				window.open(`https://misskey-hub.net/share/?${params}`, '_blank', 'noopener');
			}
			break;
		}
	}
}

async function specifyHostAndOpenRemote(options: OpenOnRemoteOptions): Promise<void> {
	const { canceled, result: hostTemp } = await os.inputText({
		title: i18n.ts.inputHostName,
		placeholder: 'misskey.example.com',
	});

	if (canceled) return;

	let targetHost: string | null = hostTemp;

	// ドメイン部分だけを取り出す
	targetHost = extractDomain(targetHost ?? '');
	if (targetHost == null) {
		os.alert({
			type: 'error',
			title: i18n.ts.invalidValue,
			text: i18n.ts.tryAgain,
		});
		return;
	}
	openRemote(options, targetHost);
}
//#endregion
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.wrapper {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: 336px;

	> .root {
		width: 100%;
	}
}

.avatar {
	margin: 0 auto;
	background-color: color-mix(in srgb, var(--MI_THEME-fg), transparent 85%);
	color: color-mix(in srgb, var(--MI_THEME-fg), transparent 25%);
	text-align: center;
	height: 64px;
	width: 64px;
	font-size: 24px;
	line-height: 64px;
	border-radius: 50%;
}

.discordCaption {
	text-align: center;
	font-size: .8em;
	color: var(--MI_THEME-fgTransparent);
}

.instanceManualSelectButton {
	display: block;
	text-align: center;
	opacity: .7;
	font-size: .8em;

	&:hover {
		text-decoration: underline;
	}
}

.orHr {
	position: relative;
	margin: .4em auto;
	width: 100%;
	height: 1px;
	background: var(--MI_THEME-divider);
}

.orMsg {
	position: absolute;
	top: -.6em;
	display: inline-block;
	padding: 0 1em;
	background: var(--MI_THEME-panel);
	font-size: 0.8em;
	color: var(--MI_THEME-fgOnPanel);
	margin: 0;
	left: 50%;
	transform: translateX(-50%);
}
</style>
