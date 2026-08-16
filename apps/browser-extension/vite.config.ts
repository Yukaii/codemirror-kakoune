import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

function copyManifestPlugin() {
  return {
    name: "copy-manifest",
    closeBundle() {
      const manifestSrc = resolve(root, "manifest.json");
      const outDir = resolve(root, "dist");
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }
      if (existsSync(manifestSrc)) {
        copyFileSync(manifestSrc, resolve(outDir, "manifest.json"));
      }
    }
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "codemirror-kakoune": resolve(root, "../../packages/codemirror-kakoune/src"),
      "codemirror-kakoune-cm5": resolve(root, "../../packages/codemirror-kakoune-cm5/src"),
      "kakoune-core-js": resolve(root, "../../packages/kakoune-core/src")
    }
  },
  plugins: [copyManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, "popup/index.html"),
        options: resolve(root, "options/index.html"),
        demo: resolve(root, "demo/index.html"),
        content: resolve(root, "src/content/index.ts"),
        background: resolve(root, "src/background/index.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "content") return "content.js";
          if (chunkInfo.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    }
  }
});
