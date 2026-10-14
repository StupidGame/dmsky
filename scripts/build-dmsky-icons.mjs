/*
 * SPDX-FileCopyrightText: 2026 DMSKY contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

const require = createRequire(new URL('../packages/backend/package.json', import.meta.url));
const sharp = require('sharp');
sharp.concurrency(1);
sharp.cache({ memory: 8, files: 0, items: 4 });
const source = await readFile(new URL('../packages/frontend/assets/dmsky-icon.svg', import.meta.url));
const assets = new URL('../packages/backend/assets/', import.meta.url);
for (const [name, size] of [['favicon.png', 32], ['apple-touch-icon.png', 180], ['icons/192.png', 192], ['icons/512.png', 512], ['splash.png', 300]]) {
	await sharp(source).resize(size, size).png().toFile(new URL(name, assets).pathname);
}

const sizes = [16, 32, 48];
const frames = [];
for (const size of sizes) frames.push(await sharp(source).resize(size, size).png().toBuffer());
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < frames.length; index++) {
	const entry = 6 + index * 16;
	header[entry] = sizes[index];
	header[entry + 1] = sizes[index];
	header.writeUInt16LE(1, entry + 4);
	header.writeUInt16LE(32, entry + 6);
	header.writeUInt32LE(frames[index].length, entry + 8);
	header.writeUInt32LE(offset, entry + 12);
	offset += frames[index].length;
}
await writeFile(new URL('favicon.ico', assets), Buffer.concat([header, ...frames]));
