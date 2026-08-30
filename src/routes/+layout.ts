// GitHub Pages is a static host: every route in this app needs to come out of the
// build as a file. Static routes (`/`, `/moves`, `/abilities`) get prerendered here;
// the dynamic `/pokemon/[showdownId]` route has no way to enumerate every possible
// id at build time, so it falls back to `404.html` (see the adapter config in
// vite.config.ts) and hydrates client-side instead — every page here is already
// `ssr = false`, so that fallback shell is all any route actually needs.
export const prerender = true;
