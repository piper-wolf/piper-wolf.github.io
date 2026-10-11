import type { ImageMetadata } from "astro";

export interface PigeonPhoto {
  image: ImageMetadata;
  number: string;
  title: string;
  queueId?: string;
  alt: string;
  date: string;
  dateTime: string;
  caption: string;
}
