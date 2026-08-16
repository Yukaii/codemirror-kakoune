import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { build } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const outDir = resolve(root, "dist");

const aliases = {
  "codemirror-kakoune": resolve(root, "../../packages/codemirror-kakoune/src"),
  "codemirror-kakoune-cm5": resolve(root, "../../packages/codemirror-kakoune-cm5/src"),
  "kakoune-core-js": resolve(root, "../../packages/kakoune-core/src")
};

function ensureUtf8(filePath) {
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, "utf8");
    // Strip BOM if present and re-write clean UTF-8
    const clean = raw.replace(/^\uFEFF/, "");
    writeFileSync(filePath, clean, { encoding: "utf8" });
  }
}

async function buildAll() {
  console.log("[build] 1/3 Building popup, options, and demo pages...");
  await build({
    root,
    configFile: false,
    resolve: { alias: aliases },
    esbuild: {
      charset: "utf8"
    },
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(root, "popup/index.html"),
          options: resolve(root, "options/index.html"),
          demo: resolve(root, "demo/index.html")
        }
      }
    }
  });

  console.log("[build] 2/3 Building content script (IIFE format)...");
  await build({
    root,
    configFile: false,
    resolve: { alias: aliases },
    esbuild: {
      charset: "utf8"
    },
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/content/index.ts"),
        name: "KakouneContentScript",
        formats: ["iife"],
        fileName: () => "content.js"
      }
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    }
  });

  console.log("[build] 3/3 Building background service worker (IIFE format)...");
  await build({
    root,
    configFile: false,
    resolve: { alias: aliases },
    esbuild: {
      charset: "utf8"
    },
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve(root, "src/background/index.ts"),
        name: "KakouneBackgroundScript",
        formats: ["iife"],
        fileName: () => "background.js"
      }
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    }
  });

  // Copy manifest.json
  const manifestSrc = resolve(root, "manifest.json");
  const manifestDest = resolve(outDir, "manifest.json");
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, manifestDest);
    console.log("[build] Copied manifest.json to dist/");
  }

  // Ensure all output files are clean UTF-8
  ensureUtf8(resolve(outDir, "content.js"));
  ensureUtf8(resolve(outDir, "background.js"));
  ensureUtf8(resolve(outDir, "manifest.json"));

  console.log("[build] Browser extension build complete!");
}

buildAll().catch(err => {
  console.error("[build] Failed:", err);
  process.exit(1);
});
