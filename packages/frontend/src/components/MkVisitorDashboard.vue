<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="instance" :class="$style.root">
	<div :class="[$style.main, $style.panel]">
		<img src="/client-assets/dmsky-icon.svg" alt="" :class="$style.mainIcon"/>
		<button class="_button _acrylic" :class="$style.mainMenu" :aria-label="i18n.ts.more" @click="showMenu"><i class="ti ti-dots" aria-hidden="true"></i></button>
		<div :class="$style.mainFg">
			<h1 :class="$style.mainTitle">
				<!-- 背景色によってはロゴが見えなくなるのでとりあえず無効に -->
				<!-- <img class="logo" v-if="instance.logoImageUrl" :src="instance.logoImageUrl"><span v-else class="text">{{ instanceName }}</span> -->
				<MkA to="/">{{ instanceName }}</MkA>
			</h1>
			<div :class="$style.mainAbout">
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-html="instance.description || i18n.ts.headlineMisskey"></div>
			</div>
			<div v-if="instance.disableRegistration || instance.federation !== 'all'" :class="$style.mainWarn" class="_gaps_s">
				<MkInfo v-if="instance.disableRegistration" warn>{{ i18n.ts.invitationRequiredToRegister }}</MkInfo>
				<MkInfo v-if="instance.federation === 'specified'" warn>{{ i18n.ts.federationSpecified }}</MkInfo>
				<MkInfo v-else-if="instance.federation === 'none'" warn>{{ i18n.ts.federationDisabled }}</MkInfo>
			</div>
			<div class="_gaps_s" :class="$style.mainActions">
				<MkButton :class="$style.mainAction" full rounded gradate data-testid="signup" @click="signup()">{{ i18n.ts.joinThisServer }}</MkButton>
				<MkButton :class="$style.mainAction" full rounded type="a" target="_blank" rel="noopener" href="https://misskey-hub.net/servers/">{{ i18n.ts.exploreOtherServers }}</MkButton>
				<MkButton :class="$style.mainAction" full rounded data-testid="signin" @click="signin()">{{ i18n.ts.login }}</MkButton>
			</div>
			<div :class="$style.disclosure">
				<p>{{ i18n.ts._dmsky.forkNotice }}</p>
				<nav :aria-label="i18n.ts.instanceInfo">
					<MkA to="/terms">{{ i18n.ts.termsOfService }}</MkA>
					<MkA to="/about-misskey">{{ i18n.ts.aboutMisskey }}</MkA>
					<a href="https://github.com/StupidGame/dmsky" target="_blank" rel="noopener noreferrer">{{ i18n.ts._dmsky.forkSource }}</a>
				</nav>
			</div>
		</div>
	</div>
	<div v-if="stats && instance.clientOptions.showActivitiesForVisitor !== false" :class="$style.stats">
		<div :class="[$style.statsItem, $style.panel]">
			<div :class="$style.statsItemLabel">{{ i18n.ts.users }}</div>
			<div :class="$style.statsItemCount"><MkNumber :value="stats.originalUsersCount"/></div>
		</div>
		<div :class="[$style.statsItem, $style.panel]">
			<div :class="$style.statsItemLabel">{{ i18n.ts.notes }}</div>
			<div :class="$style.statsItemCount"><MkNumber :value="stats.originalNotesCount"/></div>
		</div>
	</div>
	<div v-if="instance.policies.ltlAvailable && instance.clientOptions.showTimelineForVisitor !== false" :class="[$style.tl, $style.panel]">
		<div :class="$style.tlHeader">{{ i18n.ts.letsLookAtTimeline }}</div>
		<div :class="$style.tlBody">
			<MkStreamingNotesTimeline src="local"/>
		</div>
	</div>
	<div v-if="instance.clientOptions.showActivitiesForVisitor !== false" :class="$style.panel">
		<XActiveUsersChart/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import { instanceName } from '@@/js/config.js';
import type { MenuItem } from '@/types/menu.js';
import XSigninDialog from '@/components/MkSigninDialog.vue';
import XSignupDialog from '@/components/MkSignupDialog.vue';
import MkButton from '@/components/MkButton.vue';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import MkNumber from '@/components/MkNumber.vue';
import XActiveUsersChart from '@/components/MkVisitorDashboard.ActiveUsersChart.vue';
import { openInstanceMenu } from '@/ui/_common_/common.js';

const stats = ref<Misskey.entities.StatsResponse | null>(null);

if (instance.clientOptions.showActivitiesForVisitor !== false) {
	misskeyApi('stats', {}).then((res) => {
		stats.value = res;
	});
}

function signin() {
	const { dispose } = os.popup(XSigninDialog, {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

function signup() {
	const { dispose } = os.popup(XSignupDialog, {
		autoSet: true,
	}, {
		closed: () => dispose(),
	});
}

function showMenu(ev: PointerEvent) {
	openInstanceMenu(ev);
}
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 32px 0 0 0;
}

.panel {
	position: relative;
	background: linear-gradient(145deg, var(--MI_THEME-panelHeaderBg), var(--MI_THEME-panel) 40%);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	box-shadow: inset 0 1px color(from var(--MI_THEME-fg) srgb r g b / 0.08), 0 12px 32px var(--MI_THEME-shadow);
}

.main {
	text-align: center;
}

.mainIcon {
	width: 110px;
	margin-top: -62px;
	vertical-align: bottom;
	filter: drop-shadow(0 0 16px var(--MI_THEME-accent));
}

.mainMenu {
	position: absolute;
	top: 16px;
	right: 16px;
	width: 32px;
	height: 32px;
	border-radius: 8px;
	font-size: 18px;
	z-index: 50;
}

.mainFg {
	position: relative;
	z-index: 1;
}

.mainTitle {
	display: block;
	margin: 0;
	padding: 16px 32px 24px 32px;
	font-size: 1.4em;
}

.mainLogo {
	vertical-align: bottom;
	max-height: 120px;
	max-width: min(100%, 300px);
}

.mainAbout {
	padding: 0 32px;
}

.mainWarn {
	padding: 32px 32px 0 32px;
}

.mainActions {
	padding: 32px;
}

.mainAction {
	line-height: 28px;
}

:global(html.dmsky-theme) {
	.panel {
		border: 3px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
		border-radius: 6px;
		box-shadow: inset 0 0 0 1px var(--MI_THEME-dmskyFrameHighlight, var(--MI_THEME-fgHighlighted)), inset 0 0 0 4px var(--MI_THEME-dmskyFrameShadow, var(--MI_THEME-navBg)), 0 4px 0 var(--MI_THEME-dmskyFrameShadow, var(--MI_THEME-navBg));
	}

	.main {
		background: linear-gradient(160deg, var(--MI_THEME-panelHeaderBg), var(--MI_THEME-panel) 65%);
	}

	.mainIcon {
		filter: none;
	}

	.mainMenu {
		border: 1px solid var(--MI_THEME-dmskyFrame, var(--MI_THEME-divider));
		border-radius: 4px;
	}

	.mainTitle {
		padding-bottom: 16px;
		color: var(--MI_THEME-fgHighlighted);
	}

	.statsItem {
		padding: 18px 20px;
		background: linear-gradient(160deg, var(--MI_THEME-dmskyScreenHighlight, var(--MI_THEME-buttonHoverBg)), var(--MI_THEME-dmskyScreen, var(--MI_THEME-buttonBg)));
		color: var(--MI_THEME-dmskyScreenFg, var(--MI_THEME-fg));
	}

	.statsItemLabel { color: inherit; }
	.statsItemCount { color: var(--MI_THEME-dmskyActiveHighlight, var(--MI_THEME-buttonGradateB)); }

	.tlHeader {
		margin: 4px;
		border-bottom: 2px solid var(--MI_THEME-dmskyTrim, var(--MI_THEME-accent));
		background: linear-gradient(160deg, var(--MI_THEME-dmskyScreenHighlight, var(--MI_THEME-buttonHoverBg)), var(--MI_THEME-dmskyScreen, var(--MI_THEME-buttonBg)));
		color: var(--MI_THEME-dmskyScreenFg, var(--MI_THEME-fg));
		font-weight: bold;
	}
}

.disclosure {
	padding: 0 24px 24px;
	border-top: 1px solid var(--MI_THEME-divider);
	text-align: left;
	font-size: 0.85em;
	line-height: 1.6;

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
	}

	a { color: var(--MI_THEME-link); text-decoration: underline; }
}

.stats {
	display: grid;
	grid-template-columns: 1fr 1fr;
	grid-gap: 16px;
}

.statsItem {
	overflow: clip;
	padding: 16px 20px;
}

.statsItemLabel {
	color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);
	font-size: 0.9em;
}

.statsItemCount {
	font-weight: bold;
	font-size: 1.2em;
	color: var(--MI_THEME-accent);
}

.tl {
	overflow: clip;
}

.tlHeader {
	padding: 12px 16px;
	border-bottom: solid 1px var(--MI_THEME-divider);
}

.tlBody {
	height: 350px;
	overflow: auto;
}
</style>
