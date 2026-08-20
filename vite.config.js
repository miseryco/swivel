import { defineConfig } from "vite"

export default defineConfig({
	base: "/swivel/",
	build: {
		rollupOptions: {
			input: {
				index: "index.html",
				support: "support/index.html",
				privacy: "privacy/index.html",
			},
		},
	},
})
