import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const pkgPath = resolve(rootDir, "packages/codemirror-kakoune/package.json");
const jsrPath = resolve(rootDir, "packages/codemirror-kakoune/jsr.json");
const rootPkgPath = resolve(rootDir, "package.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const jsr = JSON.parse(readFileSync(jsrPath, "utf8"));
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));

jsr.version = pkg.version;
rootPkg.version = pkg.version;

writeFileSync(jsrPath, JSON.stringify(jsr, null, 2) + "\n");
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");
console.log(`Synced jsr.json and package.json version to ${pkg.version}`);
