<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="$style.root">
	<button :class="[$style.item, { [$style.active]: drawerMenuShowing }]" class="_button" :aria-label="i18n.ts.menu" :aria-pressed="drawerMenuShowing" @click="drawerMenuShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-menu-2"></i><span v-if="menuIndicated" :class="$style.itemIndicator" class="_blink"><i class="_indicatorCircle"></i></span>
		</div>
		<span :class="$style.itemLabel">{{ i18n.ts.menu }}</span>
	</button>

	<button :class="[$style.item, { [$style.active]: isHome }]" class="_button" :aria-label="i18n.ts.timeline" :aria-current="isHome ? 'page' : undefined" @click="mainRouter.push('/')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-home"></i>
		</div>
		<span :class="$style.itemLabel">{{ i18n.ts.timeline }}</span>
	</button>

	<button :class="[$style.item, { [$style.active]: isNotifications }]" class="_button" :aria-label="i18n.ts.notifications" :aria-current="isNotifications ? 'page' : undefined" @click="mainRouter.push('/my/notifications')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-bell"></i>
			<span v-if="$i?.hasUnreadNotification" :class="$style.itemIndicator" class="_blink">
				<span class="_indicateCounter" :class="$style.itemIndicateValueIcon">{{ $i.unreadNotificationsCount > 99 ? '99+' : $i.unreadNotificationsCount }}</span>
			</span>
		</div>
		<span :class="$style.itemLabel">{{ i18n.ts.notifications }}</span>
	</button>

	<button :class="[$style.item, { [$style.active]: widgetsShowing }]" class="_button" :aria-label="i18n.ts.widgets" :aria-pressed="widgetsShowing" @click="widgetsShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-apps"></i>
		</div>
		<span :class="$style.itemLabel">{{ i18n.ts.widgets }}</span>
	</button>

	<button :class="[$style.item, $style.post]" class="_button" :aria-label="i18n.ts.note" @click="os.post()">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-pencil"></i>
		</div>
		<span :class="$style.itemLabel">{{ i18n.ts.note }}</span>
	</button>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch } from 'vue';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { mainRouter } from '@/router.js';
import { navbarItemDef } from '@/navbar.js';
import { i18n } from '@/i18n.js';

const drawerMenuShowing = defineModel<boolean>('drawerMenuShowing');
const widgetsShowing = defineModel<boolean>('widgetsShowing');

const rootEl = useTemplateRef('rootEl');
const isHome = computed(() => mainRouter.currentRoute.value.name === 'index');
const isNotifications = computed(() => mainRouter.currentRoute.value.path === '/my/notifications');

const menuIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (def === 'notifications') continue; // 通知は下にボタンとして表示されてるから
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

const rootElHeight = ref(0);

watch(rootEl, () => {
	if (rootEl.value) {
		rootElHeight.value = rootEl.value.offsetHeight;
		window.document.body.style.setProperty('--MI-minBottomSpacing', 'var(--MI-minBottomSpacingMobile)');
	} else {
		rootElHeight.value = 0;
		window.document.body.style.setProperty('--MI-minBottomSpacing', '0px');
	}
}, {
	immediate: true,
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	z-index: 1;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	display: grid;
	grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
	width: 100%;
	box-sizing: border-box;
	background: var(--MI_THEME-navBg);
	color: var(--MI_THEME-navFg);
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.item {
	padding: 12px 0;

	&:first-child {
		padding-left: 12px;
	}

	&:last-child {
		padding-right: 12px;
	}

	&.post {
		.itemInner {
			background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
			color: var(--MI_THEME-fgOnAccent);

			&:hover {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}

			&:active {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}
		}
	}
}

.itemInner {
	position: relative;
	padding: 0;
	aspect-ratio: 1;
	width: 100%;
	max-width: 42px;
	margin: auto;
	align-content: center;
	border-radius: 100%;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
	}

	&:active {
		background: var(--MI_THEME-panelHighlight);
	}
}

.itemIcon {
	font-size: 15px;
}

.itemLabel { display: none; }

:global(html.dmsky-theme) {
	.root {
		border-top: 2px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
		background: linear-gradient(180deg, var(--MI_THEME-panelHeaderBg), var(--MI_THEME-navBg));
	}

	.item {
		min-width: 0;
		padding: 10px 4px 8px;

		&:focus-visible {
			outline: 2px solid var(--MI_THEME-focus);
			outline-offset: -2px;
		}
	}

	.itemInner {
		width: 44px;
		max-width: 100%;
		border: 2px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
		border-radius: 4px;
		box-sizing: border-box;
		background: linear-gradient(155deg, var(--MI_THEME-dmskyScreenHighlight, var(--MI_THEME-buttonHoverBg)), var(--MI_THEME-dmskyScreen, var(--MI_THEME-buttonBg)));
		color: var(--MI_THEME-dmskyScreenFg, var(--MI_THEME-fg));
		box-shadow: inset 0 1px 0 var(--MI_THEME-dmskyFrameHighlight, var(--MI_THEME-fgHighlighted)), 0 2px 0 var(--MI_THEME-dmskyFrameShadow, var(--MI_THEME-navBg));
	}

	.item.active .itemInner, .item.post .itemInner {
		background: linear-gradient(155deg, var(--MI_THEME-dmskyActiveHighlight, var(--MI_THEME-buttonGradateB)), var(--MI_THEME-dmskyActive, var(--MI_THEME-buttonGradateA)));
		color: var(--MI_THEME-dmskyActiveFg, var(--MI_THEME-fgOnAccent));
	}

	.itemIcon { font-size: 18px; }

	.itemLabel {
		display: block;
		max-width: 100%;
		margin-top: 5px;
		font-size: clamp(8px, 2.5vw, 10px);
		line-height: 1.4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}

.itemIndicator {
	position: absolute;
	bottom: -4px;
	left: 0;
	right: 0;
	color: var(--MI_THEME-indicator);
	font-size: 10px;
	pointer-events: none;

	&:has(.itemIndicateValueIcon) {
		animation: none;
		font-size: 8px;
	}
}
</style>
