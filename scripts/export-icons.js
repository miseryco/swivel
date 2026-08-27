import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { chromium } from 'playwright';
import { createServer } from 'vite';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(projectRoot, 'public');
const artworkRoot = join(projectRoot, 'artwork');

// public/og.png is supplied by the site author. This script only generates
// icon artwork and must never overwrite hand-authored social imagery.
const USER_MANAGED_PUBLIC_ASSETS = new Set(['og.png']);

const WEB_ASSETS = [
	{ path: 'icons/web/favicon-32x32.png', width: 32, height: 32 },
	{ path: 'icons/web/icon-192x192.png', width: 192, height: 192 },
	{ path: 'icons/web/icon-512x512.png', width: 512, height: 512 },
	{ path: 'apple-touch-icon.png', width: 180, height: 180 },
];

const FAVICON_ASSETS = [
	{ width: 16, height: 16 },
	{ width: 32, height: 32 },
	{ width: 48, height: 48 },
];

const SOCIAL_ASSETS = [
	{ path: 'icons/social/facebook-profile-320x320.png', width: 320, height: 320 },
	{ path: 'icons/social/instagram-profile-320x320.png', width: 320, height: 320 },
	{ path: 'icons/social/linkedin-profile-400x400.png', width: 400, height: 400 },
	{ path: 'icons/social/x-profile-400x400.png', width: 400, height: 400 },
	{ path: 'icons/social/youtube-profile-800x800.png', width: 800, height: 800 },
	{ path: 'icons/social/open-graph-1200x630.png', width: 1200, height: 630 },
	{ path: 'icons/social/x-summary-large-1200x600.png', width: 1200, height: 600 },
];

const MACOS_ASSETS = [
	{ path: 'icons/macos/AppIcon.iconset/icon_16x16.png', width: 16, height: 16 },
	{ path: 'icons/macos/AppIcon.iconset/icon_16x16@2x.png', width: 32, height: 32 },
	{ path: 'icons/macos/AppIcon.iconset/icon_32x32.png', width: 32, height: 32 },
	{ path: 'icons/macos/AppIcon.iconset/icon_32x32@2x.png', width: 64, height: 64 },
	{ path: 'icons/macos/AppIcon.iconset/icon_128x128.png', width: 128, height: 128 },
	{ path: 'icons/macos/AppIcon.iconset/icon_128x128@2x.png', width: 256, height: 256 },
	{ path: 'icons/macos/AppIcon.iconset/icon_256x256.png', width: 256, height: 256 },
	{ path: 'icons/macos/AppIcon.iconset/icon_256x256@2x.png', width: 512, height: 512 },
	{ path: 'icons/macos/AppIcon.iconset/icon_512x512.png', width: 512, height: 512 },
	{ path: 'icons/macos/AppIcon.iconset/icon_512x512@2x.png', width: 1024, height: 1024 },
];

const PERSPECTIVE_WIDTH = 1024;
const PERSPECTIVE_HEIGHT = 1024;
const LOOK_X = 0.2764;
const LOOK_Y = 0.2967;
const LOOK_Z = 0.9141;
const PERSPECTIVE_ASSETS = [
	{ path: 'perspectives/up-right.png', direction: [LOOK_X, LOOK_Y, LOOK_Z] },
	{ path: 'perspectives/up.png', direction: [0, LOOK_Y, LOOK_Z] },
	{ path: 'perspectives/up-left.png', direction: [-LOOK_X, LOOK_Y, LOOK_Z] },
	{ path: 'perspectives/left.png', direction: [-LOOK_X, 0, LOOK_Z] },
	{ path: 'perspectives/center.png', direction: [0, 0, LOOK_Z] },
	{ path: 'perspectives/right.png', direction: [LOOK_X, 0, LOOK_Z] },
	{ path: 'perspectives/down-left.png', direction: [-LOOK_X, -LOOK_Y, LOOK_Z] },
	{ path: 'perspectives/down.png', direction: [0, -LOOK_Y, LOOK_Z] },
	{ path: 'perspectives/down-right.png', direction: [LOOK_X, -LOOK_Y, LOOK_Z] },
];

const PNG_ASSETS = [...WEB_ASSETS, ...SOCIAL_ASSETS, ...MACOS_ASSETS, ...FAVICON_ASSETS];

function pngDimensions(png) {
	const signature = png.subarray(0, 8).toString('hex');
	if (signature !== '89504e470d0a1a0a') throw new Error('Renderer did not return a PNG file.');

	return {
		colorType: png.readUInt8(25),
		height: png.readUInt32BE(20),
		width: png.readUInt32BE(16),
	};
}

function createIco(images) {
	const headerSize = 6 + images.length * 16;
	const header = Buffer.alloc(headerSize);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);

	let imageOffset = headerSize;
	images.forEach(({ png, size }, index) => {
		const entryOffset = 6 + index * 16;
		header.writeUInt8(size === 256 ? 0 : size, entryOffset);
		header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
		header.writeUInt8(0, entryOffset + 2);
		header.writeUInt8(0, entryOffset + 3);
		header.writeUInt16LE(1, entryOffset + 4);
		header.writeUInt16LE(32, entryOffset + 6);
		header.writeUInt32LE(png.length, entryOffset + 8);
		header.writeUInt32LE(imageOffset, entryOffset + 12);
		imageOffset += png.length;
	});

	return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

async function writeAsset(root, path, contents) {
	const absolutePath = join(root, path);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, contents);
}

async function writePublicAsset(path, contents) {
	if (USER_MANAGED_PUBLIC_ASSETS.has(path)) {
		throw new Error(`Refusing to overwrite user-managed public asset: ${path}`);
	}

	await writeAsset(publicRoot, path, contents);
}

async function renderPng(page, asset) {
	const result = await page.evaluate(
		(options) => window.renderSwivelIcon(options),
		asset,
	);
	const png = Buffer.from(result.dataUrl.split(',')[1], 'base64');
	const dimensions = pngDimensions(png);

	if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
		throw new Error(`Unexpected rendered size for ${asset.width}x${asset.height}.`);
	}
	if (![4, 6].includes(dimensions.colorType) || result.minimumAlpha !== 0 || result.maximumAlpha === 0) {
		throw new Error(`The ${asset.width}x${asset.height} render does not contain transparent and visible pixels.`);
	}

	return png;
}

async function buildIcns() {
	if (process.platform !== 'darwin') {
		console.log('Skipped AppIcon.icns (iconutil is only available on macOS).');
		return;
	}

	const iconsetPath = join(artworkRoot, 'macos/AppIcon.iconset');
	const icnsPath = join(artworkRoot, 'macos/AppIcon.icns');
	await execFileAsync('iconutil', ['--convert', 'icns', '--output', icnsPath, iconsetPath]);
	console.log('Created artwork/macos/AppIcon.icns');
}

async function exportIcons() {
	const server = await createServer({
		base: '/',
		configFile: join(projectRoot, 'vite.config.js'),
		logLevel: 'error',
		root: projectRoot,
		server: { host: '127.0.0.1', port: 0 },
	});
	let browser;

	try {
		await server.listen();
		const address = server.httpServer.address();
		if (!address || typeof address === 'string') throw new Error('Could not determine the Vite server port.');

		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
		await page.goto(`http://127.0.0.1:${address.port}/scripts/icon-renderer.html`, {
			waitUntil: 'networkidle',
		});
		await page.waitForFunction(() => window.swivelIconRendererReady === true);

		const renderedImages = new Map();
		for (const asset of PNG_ASSETS) {
			const key = `${asset.width}x${asset.height}`;
			if (renderedImages.has(key)) continue;

			renderedImages.set(key, await renderPng(page, asset));
		}

		for (const asset of WEB_ASSETS) {
			await writePublicAsset(asset.path, renderedImages.get(`${asset.width}x${asset.height}`));
		}

		for (const asset of SOCIAL_ASSETS) {
			await writeAsset(artworkRoot, asset.path.replace('icons/', ''), renderedImages.get(`${asset.width}x${asset.height}`));
		}

		for (const asset of MACOS_ASSETS) {
			await writeAsset(artworkRoot, asset.path.replace('icons/', ''), renderedImages.get(`${asset.width}x${asset.height}`));
		}

		for (const asset of PERSPECTIVE_ASSETS) {
			const png = await renderPng(page, {
				...asset,
				width: PERSPECTIVE_WIDTH,
				height: PERSPECTIVE_HEIGHT,
			});
			await writeAsset(artworkRoot, asset.path, png);
		}

		const favicon = createIco([16, 32, 48].map((size) => ({
			png: renderedImages.get(`${size}x${size}`),
			size,
		})));
		await writePublicAsset('favicon.ico', favicon);

		console.log(`Created ${WEB_ASSETS.length + 1} deployable web icon files, ${SOCIAL_ASSETS.length + MACOS_ASSETS.length + 1} local social/macOS artwork files, and ${PERSPECTIVE_ASSETS.length} perspective artwork files.`);
		await buildIcns();
	} finally {
		await browser?.close();
		await server.close();
	}
}

exportIcons().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
