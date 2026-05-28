import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/codemirror-kakoune/" : "/",
  root: resolve(__dirname, "playground"),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist/playground"),
    emptyOutDir: true
  }
});
