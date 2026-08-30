// A missing/broken sprite used to render as a bare `<img src="">` — a browser broken-image
// glyph with no visual meaning. This is a self-contained placeholder (a simple Poké Ball
// outline) swapped in on load failure, so a missing image never looks like an error (see L6
// in the review).
export const SPRITE_FALLBACK =
	'data:image/svg+xml,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
			<circle cx="32" cy="32" r="28" fill="none" stroke="#b7bfb9" stroke-width="4"/>
			<path d="M4 32h56" stroke="#b7bfb9" stroke-width="4"/>
			<circle cx="32" cy="32" r="8" fill="#f4f5f1" stroke="#b7bfb9" stroke-width="4"/>
		</svg>`
	);

/** Swap a broken/missing sprite for the fallback placeholder, once, on load failure. */
export function useSpriteFallback(event: Event) {
	const img = event.currentTarget as HTMLImageElement;
	if (img.src !== SPRITE_FALLBACK) img.src = SPRITE_FALLBACK;
}
