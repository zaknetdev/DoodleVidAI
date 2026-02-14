# DoodleVid AI (Topic/Script → Full Whiteboard Video)

DoodleVid AI can now generate a full video pipeline:

1. Topic → script generation
2. Voiceover (Google TTS auto-generation in Gemini mode **or** your own uploaded/recorded MP3/WAV)
3. Scene planning + background visuals
4. Export final `.webm` video

## Google integrations

- **Voiceover:** Google Gemini TTS (`gemini-2.5-flash-preview-tts`)
- **Image scenes:** Google Gemini image generation (`gemini-2.0-flash-preview-image-generation`)
- **Script + scene analysis:** Google Gemini text generation

> Note: Google Whisk is great as a UI tool, but it does not currently provide a stable public API for direct programmatic integration in this app. This project uses Google Gemini APIs as the programmable equivalent.

## Modes

- **Gemini mode (recommended):** one-click script + AI voice + AI visuals
- **Free mode:** local script/scene fallback + local SVG visuals + your own narration file/recording

## Progress / UX

- Live percent progress
- Elapsed time and ETA during asset build
- Option to use your own uploaded voiceover file if you don’t want auto-generated voice

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

## Deploy to GitHub Pages

1. Push to your GitHub repository.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. Push to `main`.
4. Open:
   - `https://<your-github-username>.github.io/<repo-name>/`
