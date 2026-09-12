import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPhotoMetadata } from "../src/lib/photo-metadata.mjs";

for (const supplied of [false, true]) for (const withMetadata of [true, false]) {
  test(`import ${withMetadata ? "with photographic and location metadata" : "without EXIF"}, ${supplied ? "supplied metadata without Codex" : "interactive metadata"}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "photo-import-test-"));
    try {
      for (const dir of ["bin", "mocks", "src/data", "src/assets"]) mkdirSync(join(root, dir), { recursive: true });
      copyFileSync("bin/import-photo", join(root, "bin/import-photo"));
      writeFileSync(join(root, "src/data/pigeons.ts"), "const pigeonPhotos: PigeonPhoto[] = [\n];\n");
      writeFileSync(join(root, "mocks/codex"), supplied ? '#!/bin/sh\nexit 99\n' : '#!/bin/sh\nprintf "%s\\n" \'A "pigeon" with \\ feathers.\'\n', { mode: 0o755 });
      writeFileSync(join(root, "mocks/git"), '#!/bin/sh\ncase "$*" in *symbolic-ref*) echo main;; esac\n', { mode: 0o755 });
      const source = join(root, "source.jpg");
      execFileSync("convert", ["-size", "80x40", "xc:gray", source]);
      if (withMetadata) execFileSync("exiftool", ["-overwrite_original", "-Make=Test", "-Model=Camera", "-LensModel=50mm Prime",
        "-DateTimeOriginal=2020:01:02 03:04:05", "-SubSecTimeOriginal=123", "-OffsetTimeOriginal=-07:00",
        "-ExposureTime=1/250", "-FNumber=2.8", "-ISO=400", "-FocalLength=50", "-FocalLengthIn35mmFormat=75",
        "-GPSLatitude=47.6", "-GPSLongitude=-122.3", "-XMP:City=Private city", "-IPTC:Sub-location=Private street",
        "-Orientation#=6", source]);
      const caption = supplied ? 'A pigeon at the café\nwith "quotes", a \\ and\ttab.' : 'A pigeon at the café';
      const alt = 'A "pigeon" with \\ feathers.';
      execFileSync("bash", [join(root, "bin/import-photo"), source,
        ...(supplied ? ["--caption", caption, "--alt-text", alt] : [])], {
        env: { ...process.env, PATH: `${join(root, "mocks")}:${process.env.PATH}` },
        input: supplied ? '' : `${caption}\n`,
      });
      const asset = readdirSync(join(root, "src/assets")).find(name => name.endsWith(".jpg"));
      const [metadata] = JSON.parse(execFileSync("exiftool", ["-json", join(root, "src/assets", asset)], { encoding: "utf8" }));
      const data = readFileSync(join(root, "src/data/pigeons.ts"), "utf8");
      assert.match(data, /dateTime: "\d{4}-\d{2}-\d{2}"/);
      assert.ok(data.includes("A pigeon at the café"));
      assert.equal(JSON.parse(data.match(/    caption: (".*"),/)[1]), caption);
      assert.equal(JSON.parse(data.match(/    alt: (".*"),/)[1]), alt);
      assert.ok(!Object.keys(metadata).some(key => /GPS|City|Location|Thumbnail|Serial/.test(key)));
      assert.ok(!data.includes("capturedAt:"));
      assert.ok(!data.includes("photography:"));
      const details = await readPhotoMetadata(join(root, "src/assets", asset));
      if (withMetadata) {
        assert.equal(metadata.Model, "Camera");
        assert.equal(metadata.ExposureTime, "1/250");
        assert.equal(metadata.ImageWidth, 1920);
        assert.equal(metadata.ImageHeight, 3840);
        assert.equal(details.capturedAt, "2020-01-02T03:04:05.123-07:00");
        assert.equal(details.focalLength35mm, "75 mm");
        assert.equal(details.aperture, "2.8");
        assert.equal(details.shutterSpeed, "1/250");
      } else {
        assert.ok(Object.values(details).every(value => value === undefined));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
