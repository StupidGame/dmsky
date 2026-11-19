<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" :class="$style.root">
	<div :class="$style.bg" aria-hidden="true"></div>
	<div :class="$style.logoWrapper">
		<img src="/client-assets/dmsky-icon.svg" alt="" :class="$style.emblem"/>
		<div :class="$style.poweredBy">{{ i18n.ts._dmsky.designLabel }} · {{ i18n.ts._dmsky.poweredBy }}</div>
		<img :src="dmskyWordmark" alt="DMSKY" :class="$style.misskey"/>
	</div>
	<div :class="$style.contents">
		<MkVisitorDashboard/>
	</div>
</div>
</template>

<script lang="ts" setup>
import dmskyWordmark from '/client-assets/misskey.svg';
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
	background: linear-gradient(90deg, color-mix(in srgb, var(--MI_THEME-bg) 45%, transparent), transparent 80%), url('/client-assets/dmsky-city.png') center / cover;
	pointer-events: none;
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
	margin: 24px auto 0;
	padding: 12px 16px;
	border: 2px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
	border-radius: 4px;
	background: linear-gradient(155deg, var(--MI_THEME-dmskyScreenHighlight, var(--MI_THEME-panelHeaderBg)), var(--MI_THEME-dmskyScreen, var(--MI_THEME-panel)));
	color: var(--MI_THEME-dmskyScreenFg, var(--MI_THEME-fg));
	user-select: none;
	pointer-events: none;
	box-shadow: inset 0 1px 0 var(--MI_THEME-dmskyFrameHighlight, var(--MI_THEME-divider)), 0 3px 0 var(--MI_THEME-dmskyFrameShadow, var(--MI_THEME-navBg));
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
	margin: auto;
	padding: 80px 0 100px;
}
</style>
