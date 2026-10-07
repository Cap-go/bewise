# Agent Instructions

- Use `bun` and `bunx` for every command. Never npm/npx.
- Layout: `apps/mobile` (Vue 3 + Capacitor 8), `apps/api` (Hono on Cloudflare Workers + D1), `apps/website` (Astro on Cloudflare Workers static assets).
- Native chrome belongs to `@capgo/capacitor-native-navigation` (tab bar, nav bar, insets). Page bodies animate with `@capgo/capacitor-transitions`. Do not render web headers/tab bars in the native app; `WebTabbar.vue` is the browser fallback only.
- Use `--nav-top` / `--nav-bottom` CSS variables for safe spacing, never hardcoded insets.
- API schema changes go in a new numbered file in `apps/api/migrations/`, applied with `bun --cwd apps/api db:migrate`.
- Releases: bump `apps/mobile/package.json` version. CI runs `capgo build needed` to choose between an OTA live update and a native store build. Never bump the native version manually for JS-only changes.
- Validate UI on an iPhone and an iPad simulator before shipping.
