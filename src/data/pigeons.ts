import photo_2026_08_17 from "../assets/2026-08-17.jpg";

import type { ImageMetadata } from "astro";
import may14 from "../assets/2026-05-14.jpg";
import jul21 from "../assets/2026-07-21.jpg";
import aug01 from "../assets/2026-08-01.jpg";
import aug06 from "../assets/2026-08-06.jpg";
import aug07 from "../assets/2026-08-07.jpg";
import aug16Two from "../assets/2026-08-16-2.jpg";
import aug16 from "../assets/2026-08-16.jpg";

export interface PigeonPhoto {
  image: ImageMetadata;
  alt: string;
  date: string;
  dateTime: string;
  caption: string;
}

export type PigeonPost = PigeonPhoto & { number: string };

// Add one object here for each new photo. Posts are sorted and numbered below.
const pigeonPhotos: PigeonPhoto[] = [
  {
    image: photo_2026_08_17,
    alt: "Bird staring into camera straight on",
    date: "August 17, 2026",
    dateTime: "2026-08-17",
    caption: "I had this fellah's full attention today. Or at least it seems my bag of birdseed had his attention.",
  },
  {
    image: aug01,
    alt: "Large imposing pigeon staring down the ground.",
    date: "August 1, 2026",
    dateTime: "2026-08-01",
    caption:
      "This guy is definitely powering up before he unleashes his final attack.",
  },
  {
    image: jul21,
    alt: "",
    date: "July 21, 2026",
    dateTime: "2026-07-21",
    caption:
      "Don't worry folks, he did manage to catch his seed after dropping it.",
  },
  {
    image: may14,
    alt: "",
    date: "May 14, 2026",
    dateTime: "2026-05-14",
    caption:
      "Cutest little bublegum pigeon I've ever met. Can't believe how well the background showed up.",
  },
  {
    image: aug07,
    alt: "",
    date: "August 7, 2026",
    dateTime: "2026-08-07",
    caption: "Incredible depth in the eyes of this lil pigeon.",
  },
  {
    image: aug06,
    alt: "",
    date: "August 6, 2026",
    dateTime: "2026-08-06",
    caption:
      "When you're just a seagull and no one invited you to the pigeon party.",
  },
  {
    image: aug16Two,
    alt: "pigeon splayed out on top of other pigeon looks like a plane",
    date: "August 13, 2026",
    dateTime: "2026-08-13",
    caption: "WARNING! TERRAIN! TERRAIN! PULL. UP.",
  },
  {
    image: aug16,
    alt: "A curious dark pigeon looking into the camera",
    date: "August 11, 2026",
    dateTime: "2026-08-11",
    caption: "These bug eyes have stolen my heart.",
  },
];

export const pigeonPosts: PigeonPost[] = [...pigeonPhotos]
  .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
  .map((photo, index) => ({
    ...photo,
    number: String(pigeonPhotos.length - index).padStart(3, "0"),
  }));
