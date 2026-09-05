import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
  site: "https://piper-wolf.com",
  output: "static",
  trailingSlash: "always",
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
});
