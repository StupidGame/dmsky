<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" :class="$style.root">
	<div :class="$style.bg" aria-hidden="true"></div>
	<XTimeline :class="$style.tl"/>
	<div :class="$style.shape1"></div>
	<div :class="$style.shape2"></div>
	<div :class="$style.logoWrapper">
		<img src="/client-assets/dmsky-icon.svg" alt="" :class="$style.emblem"/>
		<div :class="$style.poweredBy">{{ i18n.ts._dmsky.designLabel }} · {{ i18n.ts._dmsky.poweredBy }}</div>
		<img :src="dmskyWordmark" alt="DMSKY" :class="$style.misskey"/>
	</div>
	<div :class="$style.contents">
		<MkVisitorDashboard/>
	</div>
	<div v-if="instances && instances.length > 0" :class="$style.federation">
		<MkMarqueeText :duration="40">
			<MkA v-for="instance in instances" :key="instance.id" :class="$style.federationInstance" :to="`/instance-info/${instance.host}`" behavior="window">
				<!--<MkInstanceCardMini :instance="instance"/>-->
				<img v-if="instance.iconUrl" :class="$style.federationInstanceIcon" :src="getInstanceIcon(instance)" alt=""/>
				<span class="_monospace">{{ instance.host }}</span>
			</MkA>
		</MkMarqueeText>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import XTimeline from './welcome.timeline.vue';
import MkMarqueeText from '@/components/MkMarqueeText.vue';
import dmskyWordmark from '/client-assets/misskey.svg';
import { misskeyApiGet } from '@/utility/misskey-api.js';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import { getProxiedImageUrl } from '@/utility/media-proxy.js';
import { instance as meta } from '@/instance.js';
import { i18n } from '@/i18n.js';

const instances = ref<Misskey.entities.FederationInstance[]>();

function getInstanceIcon(instance: Misskey.entities.FederationInstance): string {
	if (!instance.iconUrl) {
		return '';
	}

	return getProxiedImageUrl(instance.iconUrl, 'preview');
}

misskeyApiGet('federation/instances', {
	sort: '+pubSub',
	limit: 20,
	blocked: false,
}).then(_instances => {
	instances.value = _instances;
});
</script>

<style lang="scss" module>
.root {
	height: 100cqh;
	overflow: auto;
	overscroll-behavior: contain;
	background: var(--MI_THEME-bg);
}

.bg {
	position: fixed;
	inset: 0;
	background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-bg) 45%, transparent), transparent 72%), url('/client-assets/dmsky-city.png') center / cover;
	pointer-events: none;
}

.tl {
	position: fixed;
	top: 0;
	bottom: 0;
	right: 64px;
	margin: auto;
	padding: 128px 0;
	width: 500px;
	height: calc(100% - 256px);
	overflow: hidden;
	-webkit-mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 128px, rgba(0,0,0,1) calc(100% - 128px), rgba(0,0,0,0) 100%);
	mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 128px, rgba(0,0,0,1) calc(100% - 128px), rgba(0,0,0,0) 100%);

	@media (max-width: 1200px) {
		display: none;
	}
}

.shape1 {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: var(--MI_THEME-navBg);
	clip-path: polygon(0% 0%, 45% 0%, 20% 100%, 0% 100%);
	opacity: 0.55;
	pointer-events: none; // 装飾レイヤ。ホイール操作を透過させる (→ .bg 参照)
}
.shape2 {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: var(--MI_THEME-accent);
	clip-path: polygon(0% 0%, 25% 0%, 35% 100%, 0% 100%);
	opacity: 0.08;
	pointer-events: none; // 装飾レイヤ。ホイール操作を透過させる (→ .bg 参照)
}

.logoWrapper {
	position: relative;
	z-index: 1;
	display: grid;
	grid-template-columns: 64px 1fr;
	grid-template-rows: auto auto;
	column-gap: 14px;
	align-items: center;
	width: max-content;
	max-width: calc(100% - 64px);
	margin: 24px 0 0 128px;
	padding: 12px 16px;
	border: 2px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
	border-radius: 4px;
	background: linear-gradient(155deg, var(--MI_THEME-dmskyScreenHighlight, var(--MI_THEME-panelHeaderBg)), var(--MI_THEME-dmskyScreen, var(--MI_THEME-panel)));
	color: var(--MI_THEME-dmskyScreenFg, var(--MI_THEME-fg));
	user-select: none;
	pointer-events: none;
	box-shadow: inset 0 1px 0 var(--MI_THEME-dmskyFrameHighlight, var(--MI_THEME-divider)), 0 3px 0 var(--MI_THEME-dmskyFrameShadow, var(--MI_THEME-navBg));

	@media (max-width: 1200px) {
		margin: 24px auto 0;
	}
}

.emblem {
	grid-row: 1 / 3;
	width: 64px;
	height: 64px;
	object-fit: contain;
}

.poweredBy {
	grid-column: 2;
	grid-row: 2;
	font-size: .65em;
	letter-spacing: .06em;
}

.misskey {
	grid-column: 2;
	grid-row: 1;
	width: 180px;

	@media (max-width: 450px) {
		width: 140px;
	}
}

.contents {
	position: relative;
	width: min(460px, calc(100% - 32px));
	margin-left: 128px;
	padding: 80px 0 100px;

	@media (max-width: 1200px) {
		margin: auto;
	}
}

.federation {
	position: fixed;
	bottom: 16px;
	left: 0;
	right: 0;
	margin: auto;
	background: color(from var(--MI_THEME-panel) srgb r g b / 0.5);
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	border-radius: 999px;
	overflow: clip;
	width: 800px;
	padding: 8px 0;

	@media (max-width: 900px) {
		display: none;
	}
}

.federationInstance {
	display: inline-flex;
	align-items: center;
	vertical-align: bottom;
	padding: 6px 12px 6px 6px;
	margin: 0 10px 0 0;
	background: var(--MI_THEME-panel);
	border-radius: 999px;
}

.federationInstanceIcon {
	display: inline-block;
	width: 20px;
	height: 20px;
	margin-right: 5px;
	border-radius: 999px;
}
</style>
