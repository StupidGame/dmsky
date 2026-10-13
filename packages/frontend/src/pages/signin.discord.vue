<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 450px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps_m" :inert="waiting" aria-live="polite">
			<MkInfo v-if="error" warn>{{ error }}</MkInfo>
			<XTotp v-else-if="page === 'totp'" @totpSubmitted="token => finish({ token })"/>
			<XPasskey v-else-if="page === 'passkey' && credentialRequest" :credentialRequest="credentialRequest" @done="credential => finish({ credential })" @useTotp="page = 'totp'"/>
			<MkLoading v-else/>
			<MkButton v-if="error" @click="retry">{{ i18n.ts.retry }}</MkButton>
			<MkA to="/" class="_link">{{ i18n.ts.goBack }}</MkA>
		</div>
	</div>
</PageWithHeader>
</template>

<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import type { SigninFlowResponse } from 'misskey-js/entities.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import XTotp from '@/components/MkSignin.totp.vue';
import XPasskey from '@/components/MkSignin.passkey.vue';
import { login } from '@/accounts.js';
import { discordAuth, discordReturnPath } from '@/utility/discord-auth.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

const page = ref<'loading' | 'totp' | 'passkey'>('loading');
const waiting = ref(false);
const error = ref('');
const credentialRequest = shallowRef<PublicKeyCredentialRequestOptionsJSON | null>(null);

function retry(): void {
	window.location.assign('/auth/discord/start');
}

async function finish(body: { token?: string; credential?: AuthenticationResponseJSON; } = {}): Promise<void> {
	waiting.value = true;
	try {
		const response = await discordAuth<SigninFlowResponse>('finish', body);
		if (response.finished) {
			await login(response.i, discordReturnPath());
		} else if (response.next === 'passkey' && browserSupportsWebAuthn()) {
			credentialRequest.value = response.authRequest;
			page.value = 'passkey';
		} else {
			page.value = 'totp';
		}
	} catch {
		error.value = i18n.ts._discordLogin.failed;
	} finally {
		waiting.value = false;
	}
}

onMounted(() => {
	const reason = new URLSearchParams(window.location.search).get('error');
	if (reason) {
		error.value = reason === 'notConnected' ? i18n.ts._discordLogin.signinDescription : i18n.ts._discordLogin.failed;
	} else {
		finish();
	}
});

definePage(() => ({ title: i18n.ts._discordLogin.title, icon: 'ti ti-brand-discord' }));
</script>
