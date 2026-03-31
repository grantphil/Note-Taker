# Note-Taker

A lightweight web app for capturing meeting audio on your PC, transcribing it with OpenAI, and producing polished account-manager/project-manager style notes that are easy to paste into an email.

## What changed (quick-start UX)

The app now supports a **single primary flow**:

1. Open app
2. Click **Start Recording**
3. Click **Stop Recording**
4. Wait while it auto-transcribes + auto-generates notes
5. Click **Copy Notes**

No API setup section is shown in the UI.

## Features

- Record microphone audio during live calls.
- Optional attempt to capture system/tab audio (browser permission required).
- Automatic transcription after recording stops.
- Automatic AI note generation right after transcription.
- AI-generated structured notes with:
  - Meeting snapshot
  - Key topics
  - Decisions
  - Action items with owners and due dates
  - Risks/blockers
  - Open questions
  - Follow-up email draft
- Copy generated notes directly to clipboard.
- GitHub Pages deployment workflow for the frontend (`.github/workflows/deploy-pages.yml`).

## Requirements

- Node.js 18+
- An OpenAI API key
- A modern Chromium-based browser for best recording compatibility

## Local setup (frontend + backend together)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file and add your API key:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env`:
   ```bash
   OPENAI_API_KEY=your_key_here
   PORT=3000
   CORS_ORIGIN=*
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` and just hit record.

## Exact requirements checklist (what you need)

For the app to work end-to-end, all of these must be true:

1. **Backend is running**
   - Command: `npm start`
   - Expected: server reachable at `http://localhost:3000` (or your hosted backend URL).

2. **OpenAI API key is configured on backend**
   - Env var required: `OPENAI_API_KEY`
   - The app now checks this via `GET /api/health` (`apiKeyConfigured: true` is required).

3. **Frontend can reach backend API**
   - Local: open `http://localhost:3000` (same origin).
   - GitHub Pages: set `window.NOTE_TAKER_API_BASE` in `public/config.js` **or** use `?api_base=https://your-backend-domain`.

4. **CORS is allowed when cross-origin**
   - Set backend env var: `CORS_ORIGIN=https://<your-github-username>.github.io`

5. **Mic/system audio permissions are granted by browser**
   - Allow microphone access when prompted.
   - If capturing system audio, allow screen/tab share with audio.

## Deploying live with GitHub Pages + backend API

GitHub Pages can host the frontend UI, but **not** the Node API server. You must deploy `server.js` to a Node host (Render, Railway, Fly.io, Azure, etc.), then point the Pages site to that backend.

### A) Deploy backend API

1. Deploy this repo (or backend files) to your Node host.
2. Set backend environment variables:
   - `OPENAI_API_KEY`
   - `PORT` (platform default is fine)
   - `CORS_ORIGIN=https://<your-github-username>.github.io`
3. Confirm backend endpoints are live:
   - `POST https://your-backend-domain/api/transcribe`
   - `POST https://your-backend-domain/api/summarize`

### B) Configure frontend API endpoint (no UI setup needed)

Set `window.NOTE_TAKER_API_BASE` in `public/config.js`:

```js
window.NOTE_TAKER_API_BASE = 'https://your-backend-domain';
```

- Leave it blank (`''`) for same-origin local usage.
- This keeps the UI simple while still allowing Pages-to-backend routing.

### C) Enable GitHub Pages deployment action

This repo includes `.github/workflows/deploy-pages.yml`, which deploys `public/` to GitHub Pages on pushes to `main`.

1. Push this repository to GitHub.
2. In GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually in the Actions tab).
4. Open your Pages URL (typically `https://<user>.github.io/<repo>/`).


### Troubleshooting: "Processing failed: Failed to fetch"

This means the frontend could not reach the backend API.

- **Local run:** start backend with `npm start` and open `http://localhost:3000`.
- **GitHub Pages run:** either
  - set `window.NOTE_TAKER_API_BASE` in `public/config.js`, or
  - open the site with `?api_base=https://your-backend-domain` (for quick testing).
- Ensure backend CORS allows your Pages origin via `CORS_ORIGIN`.

## Usage

1. (Optional) Enter meeting context.
2. Click **Start Recording**.
3. If you need system audio, enable the checkbox before recording and allow screen/tab audio when prompted.
4. Click **Stop Recording**.
5. Wait for auto transcription + note generation.
6. Click **Copy Notes** and paste into your email.

## Notes on Teams audio capture

Browsers generally capture your microphone reliably. Capturing all Teams audio depends on OS/browser permissions and whether the browser exposes system audio from screen/tab share. If system audio is unavailable, use a virtual audio device or ensure Teams audio is routed to an input source the browser can access.

## Security

- API calls are proxied through the backend (`/api/transcribe`, `/api/summarize`), so your API key stays server-side.
- Do not commit your `.env` file.
