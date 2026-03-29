import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  // Обов'язково додаємо інтеграцію tailwind
  integrations: [tailwind({
    applyBaseStyles: false, // Це запобігає конфліктам зі шрифтами
  })],
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough"
  }),
});