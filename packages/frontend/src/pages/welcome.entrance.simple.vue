<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" :class="$style.root">
	<div :class="$style.bg" aria-hidden="true"></div>
	<div :class="$style.logoWrapper">
		<img src="/client-assets/dmsky-emblem.png" alt="" :class="$style.emblem"/>
		<div :class="$style.poweredBy">{{ i18n.ts._dmsky.designLabel }} · {{ i18n.ts._dmsky.poweredBy }}</div>
		<img :src="misskeysvg" :class="$style.misskey"/>
	</div>
	<div :class="$style.contents">
		<MkVisitorDashboard/>
	</div>
</div>
</template>

<script lang="ts" setup>
import misskeysvg from '/client-assets/misskey.svg';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import { instance as meta } from '@/instance.js';
import { i18n } from '@/i18n.js';
</script>

<style lang="scss" module>
.root {
	height: 100cqh;
	overflow: auto;
	overscroll-behavior: contain;
}

.bg {
	position: fixed;
	inset: 0;
	background: linear-gradient(90deg, color(from var(--MI_THEME-bg) srgb r g b / 0.7), transparent 80%), url('/client-assets/dmsky-city.png') center / cover;
	pointer-events: none;
}

.logoWrapper {
	position: fixed;
	top: 36px;
	left: 36px;
	flex: auto;
	color: #fff;
	user-select: none;
	pointer-events: none;
	text-shadow: 0 2px 12px var(--MI_THEME-shadow);
}

.emblem {
	width: 68px;
	height: 68px;
	object-fit: contain;
	filter: drop-shadow(0 0 12px var(--MI_THEME-accent));
}

.poweredBy {
	margin-bottom: 2px;
}

.misskey {
	width: 120px;

	@media (max-width: 450px) {
		width: 100px;
	}
}

.contents {
	position: relative;
	width: min(430px, calc(100% - 32px));
	margin: auto;
	padding: 100px 0 100px 0;
}
</style>
