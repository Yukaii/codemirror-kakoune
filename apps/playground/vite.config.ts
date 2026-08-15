import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/codemirror-kakoune/" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
