import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "playground"),
  publicDir: false,
  build: {
    outDir: resolve(__dirname, "dist/playground"),
    emptyOutDir: true
  }
});
