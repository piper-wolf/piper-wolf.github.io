// Handwritten presentation code. Published photo data belongs to pigeon-queue.
import { pigeonPhotos } from "./pigeons";
import type { PigeonPhoto } from "./pigeon-photo";

export type PigeonPost = PigeonPhoto;

export const pigeonPosts: PigeonPost[] = [...pigeonPhotos]
  .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
