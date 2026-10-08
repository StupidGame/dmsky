<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<main class="_spacer" style="--MI_SPACER-w: 760px; --MI_SPACER-min: 20px;">
		<article :class="$style.document">
			<header :class="$style.hero">
				<img src="/client-assets/dmsky-emblem.png" alt="" :class="$style.emblem"/>
				<div>
					<p :class="$style.eyebrow">{{ i18n.ts._dmsky.designLabel }}</p>
					<h1>{{ i18n.ts.termsOfService }}</h1>
					<p>{{ i18n.ts._dmsky.termsIntro }}</p>
				</div>
			</header>
			<div :class="$style.content">
				<p :class="$style.reference">{{ i18n.ts._dmsky.termsReference }} <a class="_link" href="https://support.misskey.io/ja/articles/14193143-%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84" target="_blank" rel="noopener noreferrer">Misskey.io</a></p>
				<section>
					<h2>{{ i18n.ts._dmsky.termsSafetyTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsSafetyBody }}</p>
				</section>
				<section>
					<h2>{{ i18n.ts._dmsky.termsSpamTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsSpamBody }}</p>
				</section>
				<section>
					<h2>{{ i18n.ts._dmsky.termsSensitiveTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsSensitiveBody }}</p>
				</section>
				<section :class="$style.highlight">
					<h2>{{ i18n.ts._dmsky.termsTopicsTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsTopicsBody }}</p>
					<p>{{ i18n.ts._dmsky.termsOracleException }}</p>
				</section>
				<section>
					<h2>{{ i18n.ts._dmsky.termsModerationTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsModerationBody }}</p>
				</section>
				<section>
					<h2>{{ i18n.ts._dmsky.termsFederationTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsFederationBody }}</p>
				</section>
				<section>
					<h2>{{ i18n.ts._dmsky.termsChangesTitle }}</h2>
					<p>{{ i18n.ts._dmsky.termsChangesBody }} <MkA to="/contact" class="_link">{{ i18n.ts.inquiry }}</MkA></p>
				</section>
			</div>
		</article>
	</main>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';

definePage(() => ({
	title: i18n.ts.termsOfService,
	icon: 'ti ti-license',
}));
</script>

<style lang="scss" module>
.document {
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
	box-shadow: 0 18px 45px var(--MI_THEME-shadow);
	overflow: clip;
}

.hero {
	display: flex;
	align-items: center;
	gap: 24px;
	padding: 32px;
	border-bottom: 1px solid var(--MI_THEME-divider);
	background: linear-gradient(110deg, var(--MI_THEME-panelHeaderBg), var(--MI_THEME-accentedBg));

	h1 {
		margin: 0 0 10px;
		font-size: 1.7em;
	}

	p { margin: 0; }

	@media (max-width: 500px) {
		gap: 12px;
		padding: 20px;
	}
}

.emblem {
	width: 82px;
	height: 82px;
	object-fit: contain;
	flex: none;
	filter: drop-shadow(0 0 14px var(--MI_THEME-accent));

	@media (max-width: 500px) { width: 56px; height: 56px; }
}

.eyebrow {
	color: var(--MI_THEME-accent);
	font-size: 0.8em;
	font-weight: bold;
	letter-spacing: 0.16em;
}

.content {
	display: grid;
	gap: 26px;
	padding: 32px;
	line-height: 1.8;

	@media (max-width: 500px) { padding: 20px; }

	section {
		padding-left: 18px;
		border-left: 2px solid var(--MI_THEME-divider);
	}

	h2 {
		margin: 0 0 8px;
		font-size: 1.15em;
	}

	p { margin: 0 0 8px; }
}

.reference { opacity: 0.78; }

.highlight {
	border-color: var(--MI_THEME-accent) !important;
	background: var(--MI_THEME-accentedBg);
	padding: 18px;
}
</style>
