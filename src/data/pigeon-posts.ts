// Handwritten presentation code. Published photo data belongs to pigeon-queue.
import { pigeonPhotos } from "./pigeons";
import type { PigeonPhoto } from "./pigeon-photo";

export type PigeonPost = PigeonPhoto;

export const pigeonPosts: PigeonPost[] = [...pigeonPhotos]
  .sort((a, b) => b.dateTime.localeCompare(a.dateTime));

// Use the publisher's existing description rather than duplicating photo metadata.
export function pigeonPageTitle(post: PigeonPost): string {
  const description = post.alt.trim().replace(/[.!?]+$/, "");
  return `Seattle pigeons: ${description} — Pigeon no. ${post.number}`;
}
