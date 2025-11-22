# Playwright Smoke Test (UI controls visibility)

- Started the Vite dev server (`npm run dev -- --host --port 4173`) and navigated with Playwright.
- Captured console logs to look for runtime issues:
  - Vite HMR connection messages
  - WebGL software fallback warnings (expected in CI)
- Discovered that Tailwind spacing utilities (e.g., `inset-0`, `p-6`) were tree-shaken from the generated CSS, leaving the overlay container positioned after the canvas. The DOM still contained the controls text, but `getBoundingClientRect()` showed the header rendered below the viewport (`top ≈ 742px`).
- Added fallback layout classes in `src/index.css` and applied them in `components/Controls.tsx` so the overlay stays pinned even if Tailwind utilities are missing.
- Re-ran Playwright to confirm the control panel is now visible in the screenshot.

Latest screenshot with controls: ![Three-body simulation with controls](browser:/invocations/eqdmpglj/artifacts/artifacts/fixed-ui.png)
