import rss from "@astrojs/rss";
import { getImage } from "astro:assets";
import type { APIRoute } from "astro";
import { pigeonPosts } from "../../data/pigeons";

const escapeHtml = (value: string) => value.replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
);

export const GET: APIRoute = async ({ site }) => rss({
  title: "Seattle pigeons — Piper Wolf",
  description: "Pigeon sightings from Seattle by Piper Wolf.",
  site: site!,
  customData: "<language>en-us</language>",
  items: await Promise.all(pigeonPosts.map(async (post) => {
    const image = await getImage({ src: post.image, width: 1200, format: "jpeg" });
    return {
      title: `Pigeon no. ${post.number}`,
      pubDate: new Date(post.dateTime),
      link: `/pigeons/${post.number}/`,
      description: post.caption,
      content: `<p><img src="${escapeHtml(new URL(image.src, site).href)}" alt="${escapeHtml(post.alt)}" /></p><p>${escapeHtml(post.caption)}</p>`,
    };
  })),
});
