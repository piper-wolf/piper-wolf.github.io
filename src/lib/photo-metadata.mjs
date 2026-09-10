import exifr from "exifr";

// Read the JPEG itself at build time. No metadata is inferred from post dates,
// filenames, or legacy comments, and no location fields are requested.
export async function readPhotoMetadata(path) {
  const tags = await exifr.parse(path, {
    gps: false, reviveValues: false,
    pick: ["Make", "Model", "LensModel", "DateTimeOriginal", "OffsetTimeOriginal",
      "SubSecTimeOriginal", "FNumber", "ExposureTime", "ISO", "FocalLength",
      "FocalLengthIn35mmFormat", "ExposureCompensation", "ExposureProgram",
      "MeteringMode", "Flash", "WhiteBalance"],
  }) ?? {};
  const original = tags.DateTimeOriginal?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);
  const offset = /^[+-]\d{2}:\d{2}$/.test(tags.OffsetTimeOriginal ?? "") ? tags.OffsetTimeOriginal : "";
  const fraction = /^\d+$/.test(tags.SubSecTimeOriginal ?? "") ? `.${tags.SubSecTimeOriginal}` : "";
  const capturedAt = original ? `${original[1]}-${original[2]}-${original[3]}T${original[4]}${fraction}${offset}` : undefined;
  const number = (value, suffix = "") => typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : undefined;
  return {
    capturedAt: capturedAt && !Number.isNaN(Date.parse(capturedAt)) ? capturedAt : undefined,
    cameraMake: tags.Make, cameraModel: tags.Model, lens: tags.LensModel,
    aperture: number(tags.FNumber),
    shutterSpeed: tags.ExposureTime > 0 ? (tags.ExposureTime < 1 ? `1/${Math.round(1 / tags.ExposureTime)}` : String(tags.ExposureTime)) : undefined,
    iso: number(tags.ISO), focalLength: number(tags.FocalLength, " mm"),
    focalLength35mm: number(tags.FocalLengthIn35mmFormat, " mm"),
    exposureCompensation: number(tags.ExposureCompensation),
    exposureProgram: tags.ExposureProgram, meteringMode: tags.MeteringMode,
    flash: tags.Flash, whiteBalance: tags.WhiteBalance,
  };
}
