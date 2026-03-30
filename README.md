# Note-Taker

A lightweight web app for capturing meeting audio on your PC, transcribing it with OpenAI, and producing polished account-manager/project-manager style notes that are easy to paste into an email.

## Features

- Record microphone audio during live calls.
- Optional attempt to capture system/tab audio (browser permission required).
- One-click transcription of recorded audio.
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
5. Open `http://localhost:3000`.

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

### B) Enable GitHub Pages deployment action

This repo includes `.github/workflows/deploy-pages.yml`, which deploys `public/` to GitHub Pages on pushes to `main`.

1. Push this repository to GitHub.
2. In GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually in the Actions tab).
4. Open your Pages URL (typically `https://<user>.github.io/<repo>/`).

### C) Connect frontend to backend

On the live Pages site:
1. Paste your backend URL into **API base URL** (e.g. `https://your-backend-domain`).
2. The app stores this value in browser localStorage.
3. Start recording and run transcription/summarization as usual.

## Usage

1. Enter API base URL (required on GitHub Pages, optional locally).
2. Enter optional meeting context (participants, customer, objective).
3. Click **Start Recording**.
4. If you need system audio, enable the checkbox before recording and allow screen/tab audio when prompted.
5. Click **Stop Recording** when the meeting or section ends.
6. Click **Transcribe Recording**.
7. Review/edit transcript.
8. Click **Generate Meeting Notes**.
9. Click **Copy Notes** and paste into your email.

## Notes on Teams audio capture

Browsers generally capture your microphone reliably. Capturing all Teams audio depends on OS/browser permissions and whether the browser exposes system audio from screen/tab share. If system audio is unavailable, use a virtual audio device or ensure Teams audio is routed to an input source the browser can access.

## Security

- API calls are proxied through the backend (`/api/transcribe`, `/api/summarize`), so your API key stays server-side.
- Do not commit your `.env` file.
