import * as THREE from 'three';

import { createScene } from '../src/webcam.js';

const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(0.2764, 0.2967, 0.9141).normalize();
const MODEL_FORWARD = new THREE.Vector3(0, 0, 1);
const MAX_RENDER_DIMENSION = 2048;
const MAX_SUPERSAMPLING = 4;

const renderer = new THREE.WebGLRenderer({
	alpha: true,
	antialias: true,
	powerPreference: 'high-performance',
	preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(0, 0, 4.1);

const { scene, head } = createScene();

const outputCanvas = document.createElement('canvas');
const outputContext = outputCanvas.getContext('2d', { alpha: true });

function validateDimension(value, label) {
	if (!Number.isInteger(value) || value < 1) {
		throw new TypeError(`${label} must be a positive integer.`);
	}
}

function resolveViewDirection(direction) {
	if (direction === undefined) return DEFAULT_VIEW_DIRECTION;
	if (!Array.isArray(direction) || direction.length !== 3 || direction.some((value) => !Number.isFinite(value))) {
		throw new TypeError('direction must be an array of three finite numbers.');
	}

	const viewDirection = new THREE.Vector3(...direction);
	if (viewDirection.lengthSq() === 0) throw new TypeError('direction must not be a zero vector.');
	return viewDirection.normalize();
}

async function renderIcon({ width, height, direction }) {
	validateDimension(width, 'width');
	validateDimension(height, 'height');

	head.quaternion.setFromUnitVectors(MODEL_FORWARD, resolveViewDirection(direction));
	head.updateMatrixWorld(true);

	const supersampling = Math.min(
		MAX_SUPERSAMPLING,
		MAX_RENDER_DIMENSION / Math.max(width, height),
	);
	const renderWidth = Math.max(width, Math.round(width * supersampling));
	const renderHeight = Math.max(height, Math.round(height * supersampling));

	renderer.setSize(renderWidth, renderHeight, false);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.clear();
	renderer.render(scene, camera);

	outputCanvas.width = width;
	outputCanvas.height = height;
	outputContext.clearRect(0, 0, width, height);
	outputContext.imageSmoothingEnabled = true;
	outputContext.imageSmoothingQuality = 'high';
	outputContext.drawImage(renderer.domElement, 0, 0, width, height);

	const pixels = outputContext.getImageData(0, 0, width, height).data;
	let minimumAlpha = 255;
	let maximumAlpha = 0;

	for (let index = 3; index < pixels.length; index += 4) {
		minimumAlpha = Math.min(minimumAlpha, pixels[index]);
		maximumAlpha = Math.max(maximumAlpha, pixels[index]);
	}

	return {
		dataUrl: outputCanvas.toDataURL('image/png'),
		maximumAlpha,
		minimumAlpha,
	};
}

window.renderSwivelIcon = renderIcon;
window.swivelIconMetadata = {
	direction: DEFAULT_VIEW_DIRECTION.toArray(),
};
window.swivelIconRendererReady = true;
