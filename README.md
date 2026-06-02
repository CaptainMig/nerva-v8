# NERVA v11 — Mobile

Decision checkpoint gate. Three-layer progressive disclosure.

## Repo structure

```
/
├── index.html              ← entry point
├── nerva-mobile-app.jsx    ← main React app (Layer 1 + bottom sheets)
├── nerva-v11-core.jsx      ← kernel + NervaV11Provider (DO NOT MODIFY)
├── nerva-storage.js        ← local-first decision log
├── nerva-sync-stub.js      ← cloud sync stub (OFF)
├── vercel.json             ← routing config
└── api/
    ├── parse.js            ← AI scenario parser (claude-opus-4-8)
    └── safety.js           ← AI safety classifier (claude-opus-4-8)
```

## Vercel deploy

1. Push this repo to GitHub
2. Import into Vercel
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Deploy — no build step needed (CDN-loaded React + Babel)

## Local test (no server)

Open `index.html` directly in Chrome/Safari. SCORE IT won't work
(needs the API endpoints) but the manual factors path runs fully offline.

## Branch: mobile-v1
