import photo_2026_09_23 from "../assets/2026-09-23.jpg";
import photo_2026_09_22 from "../assets/2026-09-22.jpg";
import photo_2026_09_21 from "../assets/2026-09-21.jpg";
import photo_2026_09_20 from "../assets/2026-09-20.jpg";

import photo_2026_09_19 from "../assets/2026-09-19.jpg";

import photo_2026_09_18 from "../assets/2026-09-18.jpg";

import photo_2026_09_17 from "../assets/2026-09-17.jpg";

import photo_2026_09_16 from "../assets/2026-09-16.jpg";

import photo_2026_09_15 from "../assets/2026-09-15.jpg";

import photo_2026_09_14 from "../assets/2026-09-14.jpg";

import photo_2026_09_13 from "../assets/2026-09-13.jpg";

import photo_2026_09_11 from "../assets/2026-09-11.jpg";

import photo_2026_09_10 from "../assets/2026-09-10.jpg";

import photo_2026_09_08 from "../assets/2026-09-08.jpg";

import photo_2026_09_06 from "../assets/2026-09-06.jpg";

import photo_2026_09_05 from "../assets/2026-09-05.jpg";

import photo_2026_09_04 from "../assets/2026-09-04.jpg";

import photo_2026_09_03 from "../assets/2026-09-03.jpg";

import photo_2026_09_01 from "../assets/2026-09-01.jpg";

import photo_2026_08_31 from "../assets/2026-08-31.jpg";

import photo_2026_08_18 from "../assets/2026-08-18.jpg";

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
  number: string;
  queueId?: string;
  alt: string;
  date: string;
  dateTime: string;
  caption: string;
}

export type PigeonPost = PigeonPhoto;

// Add one object here for each new photo. Dates are publication dates; posts are
// sorted below. Numbers are permanent and must never be reassigned.
const pigeonPhotos: PigeonPhoto[] = [
  {
    image: photo_2026_09_23,
    number: "029",
    queueId: "0c2cdab4584531cf33a9336a0f8a3519",
    alt: "Close-up of a pigeon’s eye and textured feathers against a blurred background.",
    date: "September 23, 2026",
    dateTime: "2026-09-23",
    caption: "What would the title of this movie be?",
  },
  {
    image: photo_2026_09_22,
    number: "028",
    queueId: "b5a6db979a4b45c61b7ad1af9c742670",
    alt: "Close-up of a pigeon’s head and beak against a softly blurred blue and pink background.",
    date: "September 22, 2026",
    dateTime: "2026-09-22",
    caption: "Fun fact, the white part of a pigeons beak is is called the Cere",
  },
  {
    image: photo_2026_09_21,
    number: "027",
    queueId: "a89e35095b269c0d7f621653a9100bba",
    alt: "Close-up of a gray pigeon with iridescent green neck feathers and an orange eye, holding seeds in its open beak against a blurred background.",
    date: "September 21, 2026",
    dateTime: "2026-09-21",
    caption: "Look at that joy in the pigeon's eyes, and the terror in the eyes of the seeds!!!!!",
  },
  {
    image: photo_2026_09_20,
    queueId: "31539f6dbc1025c483a29ad5d063f40e",
    alt: "Close-up of a pigeon facing the camera against a softly blurred dark background.",
    date: "September 20, 2026",
    number: "026",
    dateTime: "2026-09-20",
    caption: "Peekaboo!",
  },
  {
    image: photo_2026_09_19,
    alt: "Close-up of a pigeon facing the camera on a paved surface outdoors.",
    date: "September 19, 2026",
    number: "025",
    dateTime: "2026-09-19",
    caption: "The slanted dual tail fins indicate this model of pigeon is typically used for stealth operations in hostile airspace",
  },
  {
    image: photo_2026_09_18,
    alt: "Several pigeons crowd together in a close-up outdoor photograph.",
    date: "September 18, 2026",
    number: "024",
    dateTime: "2026-09-18",
    caption: "Standing room only at the pigeon pit today",
  },
  {
    image: photo_2026_09_17,
    alt: "Close-up of a dark pigeon facing right, with a blurred pigeon and green foliage in the background.",
    date: "September 17, 2026",
    number: "023",
    dateTime: "2026-09-17",
    caption: "Main character and sidekick energy",
  },
  {
    image: photo_2026_09_16,
    alt: "Close-up of a dark gray pigeon standing outdoors against a softly blurred green and gray background.",
    date: "September 16, 2026",
    number: "022",
    dateTime: "2026-09-16",
    caption: "Very demure, very mindful",
  },
  {
    image: photo_2026_09_15,
    alt: "Close-up of a dark pigeon pecking at scattered seeds on the ground, with other pigeons blurred in the background.",
    date: "September 15, 2026",
    number: "021",
    dateTime: "2026-09-15",
    caption: "Nom nom nom",
  },
  {
    image: photo_2026_09_14,
    alt: "Close-up pigeon looking left against a softly blurred green outdoor background.",
    date: "September 14, 2026",
    number: "020",
    dateTime: "2026-09-14",
    caption: "I love the glint in her eye, she looks happy",
  },
  {
    image: photo_2026_09_13,
    alt: "A gray pigeon with white patches, iridescent neck feathers, and an orange eye faces left against a blurred gray background.",
    date: "September 13, 2026",
    number: "019",
    dateTime: "2026-09-13",
    caption: "One more photo of cookies and cream from Friday!",
  },
  {
    image: photo_2026_09_11,
    alt: "A gray pigeon with an orange eye bends down to eat scattered seeds on the pavement.",
    date: "September 11, 2026",
    number: "018",
    dateTime: "2026-09-11",
    caption: "New pigeon stopped by today! I'm naming her cookies and cream",
  },
  {
    image: photo_2026_09_10,
    alt: "A pigeon banks in flight with its wings spread between tall city buildings.",
    date: "September 10, 2026",
    number: "017",
    dateTime: "2026-09-10",
    caption: "My pigeons didn't show up today so I had to go on the hunt for other sources of pigeon. Found this fellah up on 2nd and stewart'ish",
  },
  {
    image: photo_2026_09_08,
    alt: "A dark gray pigeon flaps its wings while landing on a concrete ledge beside a blue-tinted window.",
    date: "September 8, 2026",
    number: "016",
    dateTime: "2026-09-08",
    caption: "Photographed the moment of takeoff for a seed hunt",
  },
  {
    image: photo_2026_09_06,
    alt: "Close-up of a pigeon’s dark gray and white feathers against a softly blurred background.",
    date: "September 6, 2026",
    number: "015",
    dateTime: "2026-09-06",
    caption: "No ohio pigeons sighted, but I have plenty more Seattle pigeons in the backlog.",
  },
  {
    image: photo_2026_09_05,
    alt: "A pigeon walks toward the camera while a sparrow stands behind it on a garden path.",
    date: "September 5, 2026",
    number: "014",
    dateTime: "2026-09-05",
    caption: "BIG STEPPAH NUMBER ONE STEPPAH",
  },
  {
    image: photo_2026_09_04,
    alt: "A dark pigeon flies past a blurred gray building with one wing raised and its feet tucked beneath it.",
    date: "September 4, 2026",
    number: "013",
    dateTime: "2026-09-04",
    caption: "Photo from earlier this week! Publishing from a plane on my phone that I just installed a full dev env onto.",
  },
  {
    image: photo_2026_09_03,
    alt: "pigeon leaping from a building ledge and gaining speed",
    date: "September 3, 2026",
    number: "012",
    dateTime: "2026-09-03",
    caption: "Will be flying to Ohio this weekend, hopefully I can find a midwestern pigeon",
  },
  {
    image: photo_2026_09_01,
    alt: "pigeon leaping into the air with a leg kicked out in front of it",
    date: "September 1, 2026",
    number: "011",
    dateTime: "2026-09-01",
    caption: "Everybody was kung-fu fighting!!!",
  },
  {
    image: photo_2026_08_31,
    alt: "Pigeon sitting on a ledge with white and blue graffiti in the background",
    date: "August 31, 2026",
    number: "010",
    dateTime: "2026-08-31",
    caption: "This pigeon keeps tagging buildings downtown! Look at how smug he is.",
  },
  {
    image: photo_2026_08_18,
    alt: "pigeon in flight with brick building in background",
    date: "August 18, 2026",
    number: "009",
    dateTime: "2026-08-18",
    caption: "Today the pigeons came out to greet me before I even started throwing bird seed! I ended up having to rush getting some photos because I realized that I was on 5% battery for my camera. Will start bringing backups in the future.",
  },
  {
    image: photo_2026_08_17,
    alt: "Bird staring into camera straight on",
    date: "August 17, 2026",
    number: "008",
    dateTime: "2026-08-17",
    caption: "I had this fellah's full attention today. Or at least it seems my bag of birdseed had his attention.",
  },
  {
    image: aug01,
    alt: "Large imposing pigeon staring down the ground.",
    date: "August 1, 2026",
    number: "003",
    dateTime: "2026-08-01",
    caption:
      "This guy is definitely powering up before he unleashes his final attack.",
  },
  {
    image: jul21,
    alt: "A gray pigeon bends down to pick up a seed on a bright city sidewalk.",
    date: "July 21, 2026",
    number: "002",
    dateTime: "2026-07-21",
    caption:
      "Don't worry folks, he did manage to catch his seed after dropping it.",
  },
  {
    image: may14,
    alt: "A gray-and-white pigeon stands against a soft pink and green background.",
    date: "May 14, 2026",
    number: "001",
    dateTime: "2026-05-14",
    caption:
      "Cutest little bublegum pigeon I've ever met. Can't believe how well the background showed up.",
  },
  {
    image: aug07,
    alt: "A close-up portrait of a dark pigeon with a bright red eye against a dark background.",
    date: "August 7, 2026",
    number: "005",
    dateTime: "2026-08-07",
    caption: "Incredible depth in the eyes of this lil pigeon.",
  },
  {
    image: aug06,
    alt: "Three pigeons face the camera while a white seagull stands behind them.",
    date: "August 6, 2026",
    number: "004",
    dateTime: "2026-08-06",
    caption:
      "When you're just a seagull and no one invited you to the pigeon party.",
  },
  {
    image: aug16Two,
    alt: "pigeon splayed out on top of other pigeon looks like a plane",
    date: "August 13, 2026",
    number: "007",
    dateTime: "2026-08-13",
    caption: "WARNING! TERRAIN! TERRAIN! PULL. UP.",
  },
  {
    image: aug16,
    alt: "A curious dark pigeon looking into the camera",
    date: "August 11, 2026",
    number: "006",
    dateTime: "2026-08-11",
    caption: "These bug eyes have stolen my heart.",
  },
];

export const pigeonPosts: PigeonPost[] = [...pigeonPhotos]
  .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
