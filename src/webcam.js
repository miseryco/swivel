import * as THREE from 'three';

const SHELL_RADIUS = 1.2;
const SHELL_COLOR = '#f3efe7';
const GLOW_COLOR = '#ff4d94';
const GLASS_TINT = '#ff86b8';
const CUTOUT_ANGLE = 0.62;
const SHELL_OPENING = {
	z: SHELL_RADIUS * Math.cos(CUTOUT_ANGLE),
	radius: SHELL_RADIUS * Math.sin(CUTOUT_ANGLE),
};
const LENS_Z = SHELL_OPENING.z - 0.09;

// Four profile points form three small steps clustered around the lens.
const BEZEL_STEPS = [
	{ z: LENS_Z + 0.075, radius: 0.535 },
	{ z: LENS_Z + 0.05, radius: 0.51 },
	{ z: LENS_Z + 0.025, radius: 0.485 },
	{ z: LENS_Z, radius: 0.46 },
];

function createMesh(geometry, material, { position, rotation } = {}) {
	const mesh = new THREE.Mesh(geometry, material);

	if (position) mesh.position.set(...position);
	if (rotation) mesh.rotation.set(...rotation);

	return mesh;
}

function createCameraLens() {
	const lens = new THREE.Group();

	lens.add(
		createMesh(new THREE.CircleGeometry(0.36, 64), new THREE.MeshStandardMaterial({
			color: '#0a0b10',
			roughness: 0.55,
			metalness: 0.35,
		}), { position: [0, 0, -0.06] }),
	);

	lens.add(
		createMesh(new THREE.CircleGeometry(0.16, 64), new THREE.MeshStandardMaterial({
			color: '#050608',
			metalness: 0.6,
			roughness: 0.12,
		})),
	);

	lens.add(
		createMesh(
			new THREE.SphereGeometry(0.52, 64, 48, 0, Math.PI * 2, 0, 0.74),
			new THREE.MeshPhysicalMaterial({
				color: '#ffffff',
				transmission: 1,
				thickness: 0.65,
				ior: 1.65,
				roughness: 0.12,
				dispersion: 0.18,
				clearcoat: 1,
				clearcoatRoughness: 0.025,
				attenuationColor: GLASS_TINT,
				attenuationDistance: 0.65,
			}),
			{ position: [0, 0, 0.16], rotation: [-Math.PI / 2, 0, 0] },
		),
	);

	return lens;
}

function createWebcam() {
	const head = new THREE.Group();
	const bezelSideMaterial = new THREE.MeshPhysicalMaterial({
		color: SHELL_COLOR,
		side: THREE.DoubleSide,
		roughness: 0.55,
		clearcoat: 0.4,
		clearcoatRoughness: 0.4,
	});
	const bezelFaceMaterial = new THREE.MeshPhysicalMaterial({
		color: SHELL_COLOR,
		side: THREE.DoubleSide,
		roughness: 0.6,
		clearcoat: 0.3,
		clearcoatRoughness: 0.45,
	});

	head.add(
		createMesh(
			new THREE.SphereGeometry(
				SHELL_RADIUS,
				96,
				72,
				0,
				Math.PI * 2,
				CUTOUT_ANGLE,
				Math.PI - CUTOUT_ANGLE,
			),
			new THREE.MeshPhysicalMaterial({
				color: SHELL_COLOR,
				side: THREE.DoubleSide,
				roughness: 0.5,
				metalness: 0,
				clearcoat: 0.6,
				clearcoatRoughness: 0.35,
				sheen: 0.6,
				sheenColor: '#ffffff',
			}),
			{ rotation: [Math.PI / 2, 0, 0] },
		),
	);

	head.add(
		createMesh(
			new THREE.CylinderGeometry(
				SHELL_OPENING.radius,
				BEZEL_STEPS[0].radius,
				SHELL_OPENING.z - BEZEL_STEPS[0].z,
				72,
				1,
				true,
			),
			bezelSideMaterial,
			{
				position: [0, 0, (SHELL_OPENING.z + BEZEL_STEPS[0].z) / 2],
				rotation: [Math.PI / 2, 0, 0],
			},
		),
	);

	BEZEL_STEPS.slice(0, -1).forEach((step, index) => {
		const nextStep = BEZEL_STEPS[index + 1];
		const height = step.z - nextStep.z;

		head.add(
			createMesh(
				new THREE.CylinderGeometry(step.radius, step.radius, height, 72, 1, true),
				bezelSideMaterial,
				{
					position: [0, 0, (step.z + nextStep.z) / 2],
					rotation: [Math.PI / 2, 0, 0],
				},
			),
		);

		head.add(
			createMesh(
				new THREE.RingGeometry(nextStep.radius, step.radius, 72),
				bezelFaceMaterial,
				{ position: [0, 0, nextStep.z] },
			),
		);
	});

	head.add(
		createMesh(
			new THREE.TorusGeometry(0.44, 0.022, 20, 96),
			new THREE.MeshStandardMaterial({
				color: GLOW_COLOR,
				emissive: GLOW_COLOR,
				emissiveIntensity: 1.8,
				toneMapped: false,
			}),
			{ position: [0, 0, LENS_Z + 0.035] },
		),
	);

	const glow = new THREE.PointLight(GLOW_COLOR, 2.2, 1.5, 2.4);
	glow.position.set(0, 0, LENS_Z);
	head.add(glow);

	const lens = createCameraLens();
	lens.position.set(0, 0, LENS_Z);
	head.add(lens);

	return head;
}

export function createScene() {
	const scene = new THREE.Scene();
	const head = createWebcam();
	scene.add(head);

	scene.add(new THREE.AmbientLight('#ffffff', 0.8));
	scene.add(new THREE.HemisphereLight('#ffffff', '#c9cdd6', 0.6));

	const keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
	keyLight.position.set(4, 6, 5);
	scene.add(keyLight);

	const fillLight = new THREE.DirectionalLight('#dfe7ff', 1);
	fillLight.position.set(5, 2, -1);
	scene.add(fillLight);

	const lowerLight = new THREE.DirectionalLight('#ffffff', 0.5);
	lowerLight.position.set(5, -10, -4);
	scene.add(lowerLight);

	return { scene, head };
}

export function mountWebcam(container, motion, initialPointer) {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('webgl2', {
		antialias: true,
		alpha: true,
		powerPreference: 'low-power',
	});
	if (!context) return;

	const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
	camera.position.set(0, 0, 3.75);

	const { scene, head } = createScene();
	const target = new THREE.Vector3(0, 0, 4);
	const aim = new THREE.Object3D();
	let visible = true;
	let frame = 0;

	const resize = () => {
		const { width, height } = container.getBoundingClientRect();
		renderer.setPixelRatio(THREE.MathUtils.clamp(window.devicePixelRatio, 1, 1.75));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.render(scene, camera);
	};

	resize();
	const poster = container.querySelector('img');
	container.append(canvas);
	poster.hidden = true;
	new ResizeObserver(resize).observe(container);
	new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(container);

	function render() {
		frame = 0;
		if (!visible || !motion.matches || context.isContextLost()) return;
		head.quaternion.slerp(aim.quaternion, 0.15);
		renderer.render(scene, camera);
		if (head.quaternion.angleTo(aim.quaternion) > 0.001) frame = requestAnimationFrame(render);
	}

	function track(event) {
		if (!visible || !motion.matches || event.pointerType === 'touch') return;
		const { left, top, width, height } = container.getBoundingClientRect();
		const x = THREE.MathUtils.clamp((event.clientX - left) / width - 0.5, -1, 1);
		const y = THREE.MathUtils.clamp(0.5 - (event.clientY - top) / height, -1, 1);
		target.set(x * 2.6, y * 1.8, 4);
		aim.lookAt(target);
		if (!frame) frame = requestAnimationFrame(render);
	}

	canvas.addEventListener('webglcontextlost', () => {
		canvas.hidden = true;
		poster.hidden = false;
	});
	canvas.addEventListener('webglcontextrestored', () => {
		resize();
		canvas.hidden = false;
		poster.hidden = true;
	});
	window.addEventListener('pointermove', track, { passive: true });
	track(initialPointer);
}
