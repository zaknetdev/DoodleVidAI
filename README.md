# DoodleVid AI (Free-first Script → Whiteboard Video)

DoodleVid AI creates whiteboard-style videos from a topic in one pipeline:

1. Generate/edit script.
2. Add narration (record/upload in **free mode**, or auto-generate with Gemini mode).
3. Build storyboard scenes and visuals.
3. Build storyboard scenes and AI visuals.
4. Export final `.webm` with background music.

## Modes

- **Free mode (default):**
  - Script: local structured generator (no API key)
  - Scene analysis: local sentence segmentation
  - Visuals: local SVG whiteboard scene generation (fast + CORS-safe)
  - Images: open no-key endpoint (`image.pollinations.ai`)
  - Voice: your uploaded/recorded narration
- **Gemini mode (optional):**
  - Better script/scene quality and auto TTS using Gemini API key

## Performance and reliability improvements

- Scene rendering uses local data-URI SVG visuals to avoid third-party image outages.
- Export path reuses the audio graph to avoid `createMediaElementSource` repeat errors.
- Asset generation runs in small batches for faster production startup.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Optional Gemini key

Create `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

## Deploy to GitHub Pages (free)

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

1. Push to your GitHub repository.
2. In **Settings → Pages**, set **Build and deployment** to **GitHub Actions**.
3. Push to `main` (or run workflow manually).
4. Your app will be available at:
   - `https://<your-github-username>.github.io/<repo-name>/`

