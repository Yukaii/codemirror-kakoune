import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/codemirror-kakoune/cm5/" : "/",
  resolve: {
    alias: {
      "codemirror-kakoune-cm5": resolve(root, "../../packages/codemirror-kakoune-cm5/src"),
      "kakoune-core-js": resolve(root, "../../packages/kakoune-core/src")
    }
  },
  build: { outDir: "dist", emptyOutDir: true }
});
