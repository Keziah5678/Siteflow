// Copies MapLibre's worker modules to /public so the browser can load them
// from a stable URL (bundlers break the default import.meta.url lookup).
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const src = path.resolve("node_modules/maplibre-gl/dist");
const dest = path.resolve("public/maplibre");
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(src, f), path.join(dest, f));
console.log("maplibre worker copied to public/maplibre");
