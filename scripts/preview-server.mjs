// A minimal stand-in for GitHub Pages' own static-file behaviour, used for local
// previewing and for the e2e test suite's webServer.
//
// GitHub Pages serves `404.html` (with a 404 status) for any path that doesn't match
// a real file, and the browser renders that body regardless of status code — that's
// the whole trick this app's SPA routing (adapter-static's `fallback: '404.html'` in
// vite.config.ts) depends on for deep links like /pokemon/pikachu. None of the common
// static-file CLIs (sirv, http-server, `vite preview`) reproduce that specific
// behaviour out of the box — their single-page-app modes fall back to `index.html`
// instead, which here is a page *specifically* prerendered for `/` and hydrates as
// that route rather than resolving the real URL. So: a small server of our own.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'build');
const port = Number(process.env.PORT ?? 4173);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.woff2': 'font/woff2'
};

async function fileAt(relativePath) {
	// Strip any leading `../` so a crafted path can't escape `build/`.
	const safe = normalize(relativePath).replace(/^([/\\]?\.\.[/\\])+/, '');
	const candidate = join(root, safe);
	try {
		const info = await stat(candidate);
		if (info.isFile()) return candidate;
	} catch {
		// Not found — try the next candidate shape.
	}
	return null;
}

// adapter-static writes page routes as flat `<route>.html` files (e.g. `moves.html`)
// and the root as `index.html`, not as directories — mirror the couple of shapes a
// real static host resolves a clean URL against before giving up.
async function findFile(pathname) {
	const candidates =
		pathname === '/' || pathname === ''
			? ['index.html']
			: [pathname, `${pathname}.html`, `${pathname}/index.html`];
	for (const candidate of candidates) {
		const file = await fileAt(candidate);
		if (file) return file;
	}
	return null;
}

createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost');
	let file = await findFile(decodeURIComponent(url.pathname));
	let status = 200;
	if (!file) {
		file = join(root, '404.html');
		status = 404;
	}
	try {
		const body = await readFile(file);
		// This app's own prerendered API routes (src/routes/api/pokemon) are the only
		// extensionless files in the build and are always JSON.
		const type = MIME[extname(file)] ?? 'application/json; charset=utf-8';
		res.writeHead(status, { 'content-type': type });
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end('Not found');
	}
}).listen(port, () => {
	console.log(`Preview server listening on http://localhost:${port}`);
});
