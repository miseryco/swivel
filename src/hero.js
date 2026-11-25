const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');

async function startTracking(event) {
	if (event.pointerType === 'touch' || !motion.matches) return;
	window.removeEventListener('pointermove', startTracking);

	try {
		const { mountWebcam } = await import('./webcam.js');
		mountWebcam(document.getElementById('webcam-root'), motion, event);
	} catch {
		// The pre-rendered lens also works when the module or renderer is unavailable.
	}
}

window.addEventListener('pointermove', startTracking, { passive: true });
