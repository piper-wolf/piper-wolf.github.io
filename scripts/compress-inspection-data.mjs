import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const sourcePath = new URL("../public/playground/synology/inspection-data.csv", import.meta.url);
const compressedPath = new URL("../public/playground/synology/inspection-data.csv.gz", import.meta.url);
const source = readFileSync(sourcePath);
const compressed = gzipSync(source, { level: 9, mtime: 0 });
writeFileSync(compressedPath, compressed);
console.info(`Compressed inspection CSV: ${source.byteLength.toLocaleString()} → ${compressed.byteLength.toLocaleString()} bytes`);
