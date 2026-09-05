import type { APIRoute } from "astro";
import { pigeonPosts } from "../data/pigeons";

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'\"]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character,
  );

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site ?? new URL("https://piper-wolf.com");
  const latestDate = pigeonPosts[0]?.dateTime;
  const pages = [
    { path: "/", lastmod: latestDate },
    { path: "/pigeons/", lastmod: latestDate },
    ...pigeonPosts.map((post) => ({ path: `/pigeons/${post.number}/`, lastmod: post.dateTime })),
  ];
  const urls = pages
    .map(({ path, lastmod }) => {
      const loc = escapeXml(new URL(path, siteUrl).href);
      return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
    })
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
