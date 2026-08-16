import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/codemirror-kakoune/" : "/",
  resolve: {
    alias: {
      "codemirror-kakoune": resolve(root, "../../packages/codemirror-kakoune/src"),
      "codemirror-kakoune-cm5": resolve(root, "../../packages/codemirror-kakoune-cm5/src"),
      "kakoune-core-js": resolve(root, "../../packages/kakoune-core/src")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        cm5: resolve(root, "cm5/index.html")
      }
    }
  }
});
