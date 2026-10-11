// Handwritten adapter. pigeon-queue owns pigeons.json and its versioned schema.
// No draft/schedule data is read by the public site.
import type { ImageMetadata } from "astro";
import type { PigeonPhoto } from "./pigeon-photo";
import raw from "./pigeons.json";
import { readPublicationData } from "../lib/publication-data";

const data = readPublicationData(raw);
const images = import.meta.glob<ImageMetadata>("../assets/*.jpg", { eager: true, import: "default" });

export const pigeonPhotos: PigeonPhoto[] = data.photos.map((record) => {
  const image = images[`../assets/${record.image}`];
  if (!image) throw new Error(`Published photo ${record.number} has no image: ${record.image}`);
  return { ...record, image };
});
