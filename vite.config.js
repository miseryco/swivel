import { readFileSync } from "node:fs"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [
		{
			name: "sites-worker",
			generateBundle() {
				this.emitFile({
					type: "asset",
					fileName: "server/index.js",
					source: readFileSync(new URL("./src/server.js", import.meta.url), "utf8"),
				})
			},
		},
	],
})
