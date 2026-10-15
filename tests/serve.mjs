import { build, preview } from "astro";

await build({});
await preview({ server: { host: "127.0.0.1", port: 4321 } });
