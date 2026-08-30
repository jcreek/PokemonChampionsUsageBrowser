import { defineConfig } from '@playwright/test';

export default defineConfig({
	// The build now prerenders every eligible Pokémon's usage data against the live
	// upstream API (see src/routes/api/pokemon), which takes longer than a plain
	// static build — give it more room than Playwright's 60s default.
	webServer: { command: 'npm run build && npm run preview', port: 4173, timeout: 180_000 },
	testMatch: '**/*.e2e.{ts,js}'
});
