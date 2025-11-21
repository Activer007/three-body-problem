<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Three-Body Star System – Build & Deploy Guide

This project is a Vite + React app that renders an interactive three-body simulation. Follow the steps below to run it locally, create production builds, and deploy to your preferred static host.

## Prerequisites

- Node.js 18+ (LTS recommended) with npm
- A Gemini API key

## Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1CGbFwc8eaX53iO2g57Kn77M1kCc4SnaL


## 1. Install Dependencies

```bash
npm install
```

## 2. Run Locally (Hot Reload)

```bash
npm run dev
```

The dev server listens on `http://localhost:3000` (or another available port if 3000 is taken). Press `o` in the terminal to auto-open the browser.

## 3. Build for Production

```bash
npm run build
```

The production-ready assets are written to `dist/`. To sanity-check the optimized bundle locally, run:

```bash
npm run preview
```

## 4. Deploy

Because this is a static Vite app, you can deploy the `dist/` folder to any static host. Two common options:

### Deploy to Vercel
1. Install the CLI (`npm i -g vercel`) and run `vercel login`.
2. From the repo root run `vercel` (first deploy) or `vercel --prod` (subsequent production deploys). The default settings detect Vite automatically.

### Deploy to Netlify (or any static host)
1. Install the CLI (`npm i -g netlify-cli`) and run `netlify login`.
2. Build locally (`npm run build`).
3. Run `netlify deploy --dir=dist` for a draft URL, or add `--prod` to publish.

If you prefer manual hosting (e.g., S3, Cloudflare Pages, GitHub Pages), simply upload the contents of `dist/` and point your CDN to that directory.

---

Need help? Open an issue or ping the team. Happy launching!
