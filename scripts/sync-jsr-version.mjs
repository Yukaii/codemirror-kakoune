import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const pkgPath = resolve(rootDir, "package.json");
const jsrPath = resolve(rootDir, "jsr.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const jsr = JSON.parse(readFileSync(jsrPath, "utf8"));

jsr.version = pkg.version;
writeFileSync(jsrPath, JSON.stringify(jsr, null, 2) + "\n");
console.log(`Synced jsr.json version to ${pkg.version}`);
