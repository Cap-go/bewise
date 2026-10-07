// @ts-check
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://bewise.love',
  trailingSlash: 'never',
  compressHTML: false,
  build: { format: 'file' },
  integrations: [sitemap({ filter: page => !page.includes('/404') })],
  vite: { plugins: [tailwindcss()] },
})
